/**
 * PowerShell Obfuscation Engine (v2 — Context-Aware)
 *
 * FIXED:
 * - Removed string reverse [-1..-1] (breaks Unicode/Greek)
 * - Uses [char]0xXX and [System.Convert]::FromBase64String()
 * - Context-aware: only encodes string literals, never syntax
 * - Unicode detection → force Base64
 * - Dead code only injected at safe locations
 */

import { toBase64, xorEncryptForLanguage, resolveLanguageEscapes } from '../utils/encoding.js'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization.js'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, hasInterpolation, splitInterpolatedString } from '../utils/parser.js'
import { applyControlFlowFlattening } from './controlflow.js'
import { generatePSAmsiEtwBlock } from './amsi.js'

const IEX_STEALTH = '& ($ShellId[1]+$ShellId[13]+\'X\')'

export function obfuscatePowerShell(code, layers = []) {
  if (!code || code.trim().length === 0) return { code: '', stealthApplied: false }

  let result = code

  // FIRST: Global IEX Stealth — replace ALL IEX/Invoke-Expression BEFORE any encoding
  const stealthResult = applyIEXStealth(result)
  result = stealthResult.code
  const stealthApplied = stealthResult.applied

  if (layers.includes('randomize')) {
    result = applyVariableRandomization(result)
  }
  if (layers.includes('xorstrings')) {
    result = applyXorStringEncryption(result)
  }
  if (layers.includes('encode')) {
    result = applyStringEncoding(result)
  }
  if (layers.includes('deadcode')) {
    result = applyDeadCodeInjection(result)
  }
  if (layers.includes('controlflow')) {
    result = applyControlFlowFlattening(result, 'powershell')
  }
  if (layers.includes('antianalysis')) {
    result = applyAntiAnalysis(result)
  }
  if (layers.includes('amsietw')) {
    result = generatePSAmsiEtwBlock() + '\n' + result
  }
  if (layers.includes('encrypt')) {
    result = applyEncryptionWrapper(result)
  }

  return { code: result, stealthApplied }
}

/* ── Global IEX Stealth (runs FIRST, context-aware) ──────── */

function applyIEXStealth(code) {
  const iexPatterns = [
    /\bInvoke-Expression\b/i,
    /\bIEX\s*\(/i,
    /\biex\s*\(/i,
    /\bIEX\b/i,
    /\biex\b/i,
  ]

  let applied = false

  // Only replace in CODE tokens, never inside strings
  const result = transformCodeOnly(code, 'powershell', (codeSegment) => {
    let segment = codeSegment
    for (const pattern of iexPatterns) {
      if (pattern.test(segment)) {
        applied = true
        // Handle IEX( and iex( — keep the opening paren
        segment = segment.replace(/\b[Ii][Ee][Xx]\s*\(/g, IEX_STEALTH + ' (')
        // Handle Invoke-Expression
        segment = segment.replace(/\bInvoke-Expression\b/gi, IEX_STEALTH)
        // Handle standalone IEX (not followed by paren, already handled above)
        segment = segment.replace(/\b[Ii][Ee][Xx]\b(?!\s*\()/g, IEX_STEALTH)
        break
      }
    }
    return segment
  })

  return { code: result, applied }
}

/* ── Variable Randomization (context-aware) ──────────────── */

function maskPowerShellNonCode(code) {
  return tokenize(code, 'powershell').map((token) => {
    if (token.type === 'code') return token.value
    const raw = token.raw || token.value || ''
    return raw.replace(/[^\r\n]/g, ' ')
  }).join('')
}

function findScriptParamBlock(code) {
  const maskedCode = maskPowerShellNonCode(code)
  const match = /\bparam\s*\(/i.exec(maskedCode)
  if (!match) return null

  const prefixLines = maskedCode.slice(0, match.index).split(/\r?\n/)
  const validPrefix = prefixLines.every((line) => {
    const trimmed = line.trim()
    return trimmed === '' || /^using\s+/i.test(trimmed) ||
      /^\[(CmdletBinding|OutputType)\b/i.test(trimmed)
  })
  if (!validPrefix) return null

  const openIndex = maskedCode.indexOf('(', match.index)
  let depth = 1
  let cursor = openIndex + 1
  while (cursor < maskedCode.length && depth > 0) {
    if (maskedCode[cursor] === '(') depth++
    else if (maskedCode[cursor] === ')') depth--
    cursor++
  }
  if (depth !== 0) return null

  return {
    start: match.index,
    end: cursor,
    block: code.slice(match.index, cursor),
    prefix: code.slice(0, cursor),
  }
}

function findPowerShellPreambleEnd(code) {
  const scriptParam = findScriptParamBlock(code)
  if (scriptParam) {
    let end = scriptParam.end
    if (code[end] === '\r' && code[end + 1] === '\n') end += 2
    else if (code[end] === '\n') end++
    return end
  }

  const lines = code.match(/.*(?:\r?\n|$)/g) || []
  let offset = 0
  let inBlockComment = false

  for (const line of lines) {
    if (line === '') continue
    const trimmed = line.trim()
    let isPreamble = false

    if (inBlockComment) {
      isPreamble = true
      if (trimmed.includes('#>')) inBlockComment = false
    } else if (trimmed.startsWith('<#')) {
      isPreamble = true
      inBlockComment = !trimmed.includes('#>')
    } else if (trimmed === '' || trimmed.startsWith('#') || /^using\s+/i.test(trimmed)) {
      isPreamble = true
    }

    if (!isPreamble) break
    offset += line.length
  }

  return offset
}

function insertAfterPowerShellPreamble(code, addition) {
  const offset = findPowerShellPreambleEnd(code)
  const before = code.slice(0, offset)
  const after = code.slice(offset)
  const leadingNewline = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
  const trailingNewline = after.length > 0 ? '\n' : ''
  return before + leadingNewline + addition.trimEnd() + trailingNewline + after
}

function collectPowerShellParameterNames(code) {
  const maskedCode = maskPowerShellNonCode(code)

  const names = new Set()
  const paramStart = /\bparam\s*\(/gi
  let match

  while ((match = paramStart.exec(maskedCode)) !== null) {
    const openIndex = maskedCode.indexOf('(', match.index)
    let depth = 1
    let cursor = openIndex + 1

    while (cursor < maskedCode.length && depth > 0) {
      if (maskedCode[cursor] === '(') depth++
      else if (maskedCode[cursor] === ')') depth--
      cursor++
    }

    const block = maskedCode.slice(openIndex + 1, depth === 0 ? cursor - 1 : cursor)
    const variablePattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
    let variableMatch
    while ((variableMatch = variablePattern.exec(block)) !== null) {
      names.add(variableMatch[1].toLowerCase())
    }

    paramStart.lastIndex = cursor
  }

  return names
}

function applyVariableRandomization(code) {
  const reserved = new Set([
    'null', 'true', 'false', 'args', 'input', 'PSCommandPath',
    'PSScriptRoot', 'MyInvocation', 'ErrorActionPreference', '_',
    'env', 'Host', 'PWD', 'HOME', 'PSVersionTable', 'LASTEXITCODE',
    'Error', 'Matches', 'ForEach', 'switch', 'process', 'begin', 'end',
    // Critical PS auto-variables (must NEVER rename)
    'ShellId', 'ExecutionContext', 'PID', 'PSItem', 'this',
    'PSCulture', 'PSUICulture', 'PSEdition', 'IsWindows', 'IsLinux', 'IsMacOS',
    'ProgressPreference', 'VerbosePreference', 'WarningPreference',
    'DebugPreference', 'InformationPreference', 'ConfirmPreference',
    'WhatIfPreference', 'OFS', 'ConsoleFileName', 'MaximumHistoryCount',
    'NestedPromptLevel', 'StackTrace', 'PSDefaultParameterValues',
    'PSModuleAutoLoadingPreference', 'PSSessionConfigurationName',
    'PSBoundParameters', 'PSCmdlet', 'PSSenderInfo', 'PSDebugContext',
    'Profile', 'Sender', 'Event', 'EventArgs', 'EventSubscriber', 'PSHOME',
    'EnabledExperimentalFeatures', 'Transcript',
    // .NET / PS methods (dot-notation targets)
    'GetType', 'GetField', 'SetValue', 'ToString', 'GetBytes', 'GetString',
    'FromBase64String', 'ToBase64String', 'Invoke', 'Create', 'Load',
    'Start', 'Stop', 'Write', 'Read', 'Close', 'Dispose', 'Sleep',
    'Copy', 'Move', 'Split', 'Join', 'Replace', 'Trim', 'Contains',
    'StartsWith', 'EndsWith', 'Length', 'Count', 'Add', 'Remove',
    'Clear', 'ToArray', 'ToList', 'Format', 'Assembly', 'GetModules',
    'LoadWithPartialName', 'GetProcAddress', 'VirtualProtect',
    'LoadLibrary', 'GetHINSTANCE', 'InvokeCommand', 'InvokeScript',
    'AddScript', 'GetEnumerator', 'MoveNext', 'Current', 'Value',
    'Name', 'FullName', 'BaseType', 'IsPublic', 'Substring',
    // Scope/drive prefixes in variables such as $global:name or $env:PATH
    'global', 'script', 'local', 'private', 'using',
  ])
  const reservedLower = new Set([...reserved].map((name) => name.toLowerCase()))
  const parameterNames = collectPowerShellParameterNames(code)

  // First pass: collect variables from CODE tokens only
  const tokens = tokenize(code, 'powershell')
  const varMap = {}
  const occupiedNames = new Set(reservedLower)

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const namePattern = /[$@]([a-zA-Z_][a-zA-Z0-9_]*)/g
    let match
    while ((match = namePattern.exec(token.value)) !== null) {
      occupiedNames.add(match[1].toLowerCase())
    }
  }

  const createUniqueVariableName = () => {
    let candidate
    do {
      candidate = randomVarName('short')
    } while (occupiedNames.has(candidate.toLowerCase()))
    occupiedNames.add(candidate.toLowerCase())
    return candidate
  }

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      const key = varName.toLowerCase()
      if (!reservedLower.has(key) && !key.startsWith('ps') && !parameterNames.has(key) && !varMap[key]) {
        varMap[key] = createUniqueVariableName()
      }
    }
  }

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename $vars in a string
  const renameVarsInText = (text, includeSplat = false) => {
    let result = text
    for (const varName of sortedVars) {
      // $varName and ${varName}
      const regex = new RegExp('\\$' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi')
      const braceRegex = new RegExp('\\$\\{' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'gi')
      const splatRegex = new RegExp('@' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi')
      result = result.replace(braceRegex, '${' + varMap[varName] + '}')
      result = result.replace(regex, '$' + varMap[varName])
      if (includeSplat) result = result.replace(splatRegex, '@' + varMap[varName])
    }
    return result
  }

  // Second pass: replace in CODE tokens AND inside interpolated strings
  const transformed = tokens.map(token => {
    if (token.type === 'code') {
      return { ...token, value: renameVarsInText(token.value, true) }
    }
    // Rename inside double-quoted strings and double-quoted here-strings;
    // PowerShell interpolates variables in both forms.
    if (token.type === 'string' && (token.quoteChar === '"' || token.quoteChar === '@"')) {
      const newValue = splitInterpolatedString(token.value, 'powershell')
        .map((segment) => segment.type === 'var' ? renameVarsInText(segment.value) : segment.value)
        .join('')
      const raw = token.quoteChar === '@"' ? `@"${newValue}"@` : `"${newValue}"`
      return { ...token, value: newValue, raw }
    }
    return token
  })

  return tokensToCode(transformed)
}

/* ── Encode a single static text segment for PowerShell ──── */

function encodeStaticPS(rawText) {
  if (!rawText) return ''
  const resolved = resolveLanguageEscapes(rawText, 'powershell')
  if (hasUnicode(resolved)) {
    return `([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${toBase64(resolved)}")))`
  }
  const method = Math.floor(Math.random() * 2)
  if (method === 0) {
    const chars = Array.from(resolved).map(c => `[char]0x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('+')
    return `(${chars})`
  }
  return `([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${toBase64(resolved)}")))`
}

/* ── String Encoding (interpolation-aware, Unicode-safe) ─── */

function applyStringEncoding(code) {
  const preambleEnd = findPowerShellPreambleEnd(code)
  const preamble = code.slice(0, preambleEnd)
  const tokens = tokenize(code.slice(preambleEnd), 'powershell')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    // Skip here-strings
    if (quoteChar === '@"' || quoteChar === "@'") {
      return `@${quoteChar[1]}${content}${quoteChar[1]}@`
    }
    // Skip single-quoted (literal)
    if (quoteChar === "'") {
      return `'${content}'`
    }

    // Check for variable interpolation
    if (hasInterpolation(content, 'powershell')) {
      const segments = splitInterpolatedString(content, 'powershell')
      const parts = segments.map(seg => {
        if (seg.type === 'var') return seg.value // Leave $var intact
        if (seg.value.length === 0) return ''
        return encodeStaticPS(seg.value)
      }).filter(p => p.length > 0)
      return `(${parts.join(' + ')})`
    }

    // No interpolation — encode entire string
    return encodeStaticPS(content)
  })

  return preamble + tokensToCode(transformed)
}

/* ── XOR String Encryption (Platinum) ────────────────────── */

function applyXorStringEncryption(code) {
  const funcName = randomFuncName()
  let helperInjected = false
  const preambleEnd = findPowerShellPreambleEnd(code)
  const preamble = code.slice(0, preambleEnd)
  const tokens = tokenize(code.slice(preambleEnd), 'powershell')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    if (quoteChar === '@"' || quoteChar === "@'" || quoteChar === "'") {
      return quoteChar === "'" ? `'${content}'` : `@${quoteChar[1]}${content}${quoteChar[1]}@`
    }
    if (content.length < 3) return `"${content}"`

    // Interpolation-aware XOR: only encrypt static segments
    if (hasInterpolation(content, 'powershell')) {
      const segments = splitInterpolatedString(content, 'powershell')
      const parts = segments.map(seg => {
        if (seg.type === 'var') return seg.value
        if (seg.value.length < 3) return `"${seg.value}"`
        const xor = xorEncryptForLanguage(seg.value, 'powershell', funcName)
        if (!helperInjected) helperInjected = true
        return xor.inline
      }).filter(p => p.length > 0)
      return `(${parts.join(' + ')})`
    }

    const xor = xorEncryptForLanguage(content, 'powershell', funcName)
    if (!helperInjected) helperInjected = true
    return xor.inline
  })

  let result = preamble + tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'powershell', funcName).helper
    result = insertAfterPowerShellPreamble(result, helper)
  }
  return result
}

/* ── Dead Code Injection (safe locations only) ───────────── */

function applyDeadCodeInjection(code) {
  // These constructs only allow specific members/statements in their bodies.
  // A conservative no-op is safer than emitting syntactically valid but
  // behavior-changing code in one of those restricted locations.
  const maskedCode = maskPowerShellNonCode(code)
  if (/(^|\n)\s*(begin|process|end|clean|dynamicparam)\s*\{/i.test(maskedCode) ||
      /(^|\n)\s*(class|enum|data)\s+/i.test(maskedCode)) {
    return code
  }

  const lines = code.split('\n')
  const maskedLines = maskedCode.split('\n')
  const result = []
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  const switchDepths = []
  const hashtableDepths = []
  const protectedLines = new Set()
  let tokenLine = 0

  for (const token of tokenize(code, 'powershell')) {
    const raw = token.raw || token.value || ''
    const newlines = (raw.match(/\n/g) || []).length
    if (token.type === 'string' && (token.quoteChar === '@"' || token.quoteChar === "@'")) {
      for (let line = tokenLine; line <= tokenLine + newlines; line++) protectedLines.add(line)
    }
    tokenLine += newlines
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const codeOnly = maskedLines[i] || ''
    const trimmed = codeOnly.trim()
    const startsSwitch = /^switch\b/i.test(trimmed)

    for (let cursor = 0; cursor < codeOnly.length; cursor++) {
      const ch = codeOnly[cursor]
      if (ch === '(') parenDepth++
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
      else if (ch === '[') bracketDepth++
      else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1)
      else if (ch === '{') {
        braceDepth++
        if (codeOnly[cursor - 1] === '@') hashtableDepths.push(braceDepth)
      } else if (ch === '}') {
        braceDepth = Math.max(0, braceDepth - 1)
        while (hashtableDepths.length > 0 && braceDepth < hashtableDepths[hashtableDepths.length - 1]) {
          hashtableDepths.pop()
        }
      }
    }

    if (startsSwitch && codeOnly.includes('{')) switchDepths.push(braceDepth)
    while (switchDepths.length > 0 && braceDepth < switchDepths[switchDepths.length - 1]) {
      switchDepths.pop()
    }

    result.push(line)
    if (i > 0 && i % (3 + Math.floor(Math.random() * 3)) === 0) {
      let nextTrimmed = ''
      for (let next = i + 1; next < maskedLines.length; next++) {
        nextTrimmed = (maskedLines[next] || '').trim()
        if (nextTrimmed) break
      }
      const hasRequiredContinuation = /^(else|elseif|catch|finally|while|until)\b/i.test(nextTrimmed)
      const isCompleteStatement = trimmed.length > 0 &&
        parenDepth === 0 && bracketDepth === 0 && switchDepths.length === 0 && hashtableDepths.length === 0 &&
        !/[{|,`]$/.test(trimmed) && !/^param\s*\(/i.test(trimmed) &&
        !/^\d+\s*\{/i.test(trimmed) && !trimmed.endsWith('|') && !trimmed.startsWith('|') &&
        !protectedLines.has(i) && !hasRequiredContinuation &&
        !/^\[(CmdletBinding|OutputType|Parameter)\b/i.test(trimmed)

      if (isCompleteStatement) {
        const indent = line.match(/^(\s*)/)?.[1] || ''
        result.push(indent + generateDeadCode('powershell'))
      }
    }
  }

  return result.join('\n')
}

/* ── Anti-Analysis ───────────────────────────────────────── */

function applyAntiAnalysis(code) {
  const v1 = randomVarName('short')
  const v2 = randomVarName('short')
  const v3 = randomVarName('short')
  const v4 = randomVarName('short')
  const sleepMs = 1000 + Math.floor(Math.random() * 4000)

  const antiAnalysis = `# Environment validation
$${v1} = [Environment]::ProcessorCount
if ($${v1} -lt 2) { exit }
$${v2} = [long]0
try {
    $${v4} = Get-Command Get-CimInstance -ErrorAction SilentlyContinue
    if ($null -ne $${v4}) {
        $${v2} = [long](Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory
    } elseif ($null -ne (Get-Command Get-WmiObject -ErrorAction SilentlyContinue)) {
        $${v2} = [long](Get-WmiObject -Class Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory
    }
} catch {
    $${v2} = 0
}
if ($${v2} -gt 0 -and $${v2} -lt 2GB) { exit }
$${v3} = [System.DateTime]::Now
Start-Sleep -Milliseconds ${sleepMs}
if (([System.DateTime]::Now - $${v3}).TotalMilliseconds -lt ${Math.floor(sleepMs * 0.8)}) { exit }
`

  return insertAfterPowerShellPreamble(code, antiAnalysis)
}

/* ── Polymorphic Encryption Wrapper (v4.5) ───────────────── */

function psJunk() {
  const pool = [
    () => { const v = randomVarName('short'); return `$${v} = [int](${Math.floor(Math.random()*999)} * ${Math.floor(Math.random()*99)} + ${Math.floor(Math.random()*9999)}) % 256` },
    () => { const v = randomVarName('short'); return `$${v} = [System.BitConverter]::GetBytes(${Math.floor(Math.random()*0xFFFFFF)})` },
    () => { const v = randomVarName('short'); return `$${v} = "${Array.from({length: 6}, () => String.fromCharCode(65 + Math.floor(Math.random()*26))).join('')}"` },
    () => `[void]([Math]::Pow(${Math.floor(Math.random()*99)}, ${2 + Math.floor(Math.random()*3)}))`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function psLoopJunk(iv) {
  const pool = [
    () => `        [void]($${iv} * ${3 + Math.floor(Math.random()*17)} + ${Math.floor(Math.random()*255)})`,
    () => `        [void]($${iv} -bxor ${Math.floor(Math.random()*0xFF)})`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function psShuf(arr) {
  const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }; return a
}

/* ── Stealth Invocation (v4.7) ───────────────────────────── */

function stealthInvoke(payloadExpr, scriptParam = null) {
  const pv = randomVarName('short')
  const scriptBlockVar = randomVarName('short')
  const invocationArgs = scriptParam ? '@PSBoundParameters' : '@args'
  const methods = [
    () => `$${pv} = ${payloadExpr}\n$${scriptBlockVar} = [ScriptBlock]::Create($${pv})\n& $${scriptBlockVar} ${invocationArgs}`,
    () => `$${pv} = ${payloadExpr}\n& ([ScriptBlock]::Create($${pv})) ${invocationArgs}`,
  ]
  return methods[Math.floor(Math.random() * methods.length)]()
}

function wrapperPreamble(scriptParam) {
  return scriptParam ? scriptParam.prefix.trimEnd() + '\n\n' : ''
}

function applyEncryptionWrapper(code) {
  // A wrapper is a new script scope. Duplicate a top-level param block in the
  // wrapper and pass the bound values to the decoded script so CLI arguments
  // retain their original meaning.
  const scriptParam = findScriptParamBlock(code)
  const m = Math.floor(Math.random() * 4)
  switch (m) {
    case 0: return psWrapperXorB64(code, scriptParam)
    case 1: return psWrapperHexShift(code, scriptParam)
    case 2: return psWrapperMultiXor(code, scriptParam)
    case 3: return psWrapperByteRot(code, scriptParam)
    default: return psWrapperXorB64(code, scriptParam)
  }
}

function psWrapperXorB64(code, scriptParam) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorData = Array.from(b64).map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  const dv = randomVarName('short'), kv = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short'), iv = randomVarName('short')

  const inits = psShuf([
    `$${kv} = @(${key.join(',')})`,
    `$${dv} = @(${xorData.join(',')})`,
    psJunk(), psJunk(),
  ])

  return `${wrapperPreamble(scriptParam)}# Polymorphic payload
${inits.join('\n')}

function ${fv}($d, $k) {
    $${rv} = ""
    for ($${iv} = 0; $${iv} -lt $d.Length; $${iv}++) {
${psLoopJunk(iv)}
        $${rv} += [char]($d[$${iv}] -bxor $k[$${iv} % $k.Length])
    }
    return $${rv}
}

${stealthInvoke(`[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($(${fv} $${dv} $${kv})))`, scriptParam)}
`
}

function psWrapperHexShift(code, scriptParam) {
  const shift = 3 + Math.floor(Math.random() * 25)
  // B64-first: encode to Base64 (ASCII-safe) THEN hex-shift
  const b64 = toBase64(code)
  const hexStr = Array.from(b64).map(c => ((c.charCodeAt(0) + shift) % 256).toString(16).padStart(2, '0')).join('')

  const dv = randomVarName('short'), sv = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short')

  const inits = psShuf([`$${dv} = "${hexStr}"`, `$${sv} = ${shift}`, psJunk()])

  return `${wrapperPreamble(scriptParam)}${inits.join('\n')}

function ${fv}($h, $s) {
    $${rv} = ""
    for ($i = 0; $i -lt $h.Length; $i += 2) {
${psLoopJunk('i')}
        $b = [Convert]::ToInt32($h.Substring($i, 2), 16)
        $${rv} += [char](($b - $s + 256) % 256)
    }
    return $${rv}
}

${stealthInvoke(`[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($(${fv} $${dv} $${sv})))`, scriptParam)}
`
}

function psWrapperMultiXor(code, scriptParam) {
  const k1 = randomXorKey(16), k2 = randomXorKey(16)
  // B64-first: encode to Base64 (ASCII-safe) THEN double-XOR
  const b64 = toBase64(code)
  const enc = Array.from(b64).map((c, i) => (c.charCodeAt(0) ^ k1[i % k1.length]) ^ k2[i % k2.length])

  const dv = randomVarName('short'), k1v = randomVarName('short'), k2v = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short')

  const inits = psShuf([`$${dv} = @(${enc.join(',')})`, `$${k1v} = @(${k1.join(',')})`, `$${k2v} = @(${k2.join(',')})`, psJunk(), psJunk()])

  return `${wrapperPreamble(scriptParam)}${inits.join('\n')}

function ${fv}($d, $a, $b) {
    $${rv} = ""
    for ($i = 0; $i -lt $d.Length; $i++) {
${psLoopJunk('i')}
        $${rv} += [char](($d[$i] -bxor $b[$i % $b.Length]) -bxor $a[$i % $a.Length])
    }
    return $${rv}
}

${stealthInvoke(`[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($(${fv} $${dv} $${k1v} $${k2v})))`, scriptParam)}
`
}

function psWrapperByteRot(code, scriptParam) {
  const rotN = 3 + Math.floor(Math.random() * 50)
  const b64 = toBase64(code)
  const rot = Array.from(b64).map(c => (c.charCodeAt(0) + rotN) % 256)

  const dv = randomVarName('short'), nv = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short')

  const inits = psShuf([`$${dv} = @(${rot.join(',')})`, `$${nv} = ${rotN}`, psJunk(), psJunk()])

  return `${wrapperPreamble(scriptParam)}${inits.join('\n')}

function ${fv}($d, $n) {
    $${rv} = ""
    for ($i = 0; $i -lt $d.Length; $i++) {
${psLoopJunk('i')}
        $${rv} += [char](($d[$i] - $n + 256) % 256)
    }
    return $${rv}
}

${stealthInvoke(`[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($(${fv} $${dv} $${nv})))`, scriptParam)}
`
}
