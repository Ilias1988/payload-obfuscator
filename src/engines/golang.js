/**
 * Go Obfuscation Engine (v2 — Context-Aware)
 *
 * FIXED:
 * - Safe byte slice encoding (no inline func() trick)
 * - Context-aware: string encoding only inside literals
 * - Dead code only at safe locations
 * - Unicode → force Base64
 */

import { toBase64, xorEncryptForLanguage } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, isSafeForInjection } from '../utils/parser'
import { applyControlFlowFlattening } from './controlflow'

export function obfuscateGo(code, layers = []) {
  if (!code || code.trim().length === 0) return ''

  let result = code

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
    result = applyControlFlowFlattening(result, 'go')
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

  return result
}

/* ── Variable Randomization (context-aware) ──────────────── */

function applyVariableRandomization(code) {
  const reserved = new Set([
    'main', 'func', 'var', 'const', 'type', 'struct', 'interface',
    'package', 'import', 'return', 'if', 'else', 'for', 'range',
    'switch', 'case', 'default', 'break', 'continue', 'go', 'chan',
    'defer', 'select', 'nil', 'true', 'false', 'err', 'fmt',
    'os', 'net', 'exec', 'io', 'strings', 'strconv', 'bytes',
    'runtime', 'time', 'encoding', 'base64', 'make', 'len', 'cap',
    'append', 'copy', 'delete', 'print', 'println', 'string', 'byte',
    'int', 'int64', 'float64', 'bool', 'error', 'map', 'slice',
  ])

  const tokens = tokenize(code, 'go')
  const varMap = {}

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !varMap[varName] && varName.length > 1 && varName !== '_') {
        varMap[varName] = randomVarName('camelCase')
      }
    }
  }

  if (Object.keys(varMap).length === 0) return code

  return transformCodeOnly(code, 'go', (codeSegment) => {
    let result = codeSegment
    const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
    for (const varName of sortedVars) {
      const regex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      result = result.replace(regex, varMap[varName])
    }
    return result
  })
}

/* ── String Encoding (safe byte slice) ───────────────────── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'go')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    // Skip backtick strings (raw strings) — never obfuscate
    if (quoteChar === '`') {
      return '`' + content + '`'
    }

    // Unicode → Base64
    if (hasUnicode(content)) {
      const b64 = toBase64(content)
      // This requires encoding/base64 import
      return `func() string { d, _ := base64.StdEncoding.DecodeString("${b64}"); return string(d) }()`
    }

    // ASCII: safe byte slice
    const bytes = Array.from(content)
      .map((c) => c.charCodeAt(0))
      .join(', ')
    return `string([]byte{${bytes}})`
  })

  return tokensToCode(transformed)
}

/* ── XOR String Encryption (Platinum) ────────────────────── */

function applyXorStringEncryption(code) {
  const funcName = '_xd' + randomFuncName()
  let helperInjected = false
  const tokens = tokenize(code, 'go')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    if (quoteChar === '`') return '`' + content + '`'
    if (content.length < 3) return `"${content}"`

    const xor = xorEncryptForLanguage(content, 'go', funcName)
    if (!helperInjected) helperInjected = true
    return xor.inline
  })

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'go', funcName).helper
    // Insert helper function before func main()
    const mainIdx = result.indexOf('func main()')
    if (mainIdx !== -1) {
      result = result.substring(0, mainIdx) + helper + '\n\n' + result.substring(mainIdx)
    } else {
      result = helper + '\n\n' + result
    }
  }
  return result
}

/* ── Dead Code Injection (safe locations only) ───────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i])
    if (i > 0 && i % (4 + Math.floor(Math.random() * 3)) === 0) {
      if (isSafeForInjection(lines[i], 'go')) {
        result.push('\t' + generateDeadCode('go'))
      }
    }
  }

  return result.join('\n')
}

/* ── Anti-Analysis ───────────────────────────────────────── */

function applyAntiAnalysis(code) {
  const v1 = randomVarName('camelCase')
  const v2 = randomVarName('camelCase')
  const sleepMs = 1000 + Math.floor(Math.random() * 4000)

  const antiAnalysis = `\t// Environment validation
\t${v1} := runtime.NumCPU()
\tif ${v1} < 2 {
\t\tos.Exit(0)
\t}
\t${v2} := time.Now()
\ttime.Sleep(${sleepMs} * time.Millisecond)
\tif time.Since(${v2}).Milliseconds() < ${Math.floor(sleepMs * 0.8)} {
\t\tos.Exit(0)
\t}`

  let result = code
  if (!result.includes('"runtime"')) {
    result = result.replace(/import \(/, 'import (\n\t"runtime"\n\t"time"')
  }

  const mainIndex = result.indexOf('func main()')
  if (mainIndex !== -1) {
    const braceIndex = result.indexOf('{', mainIndex)
    if (braceIndex !== -1) {
      return result.substring(0, braceIndex + 1) + '\n' + antiAnalysis + '\n' + result.substring(braceIndex + 1)
    }
  }

  return result
}

/* ── Encryption Wrapper ──────────────────────────────────── */

function applyEncryptionWrapper(code) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorEncoded = Array.from(b64)
    .map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  const funcName = randomFuncName()
  const keyVar = randomVarName('camelCase')
  const dataVar = randomVarName('camelCase')

  return `package main

import (
\t"encoding/base64"
\t"fmt"
)

func ${funcName}(data []byte, key []byte) string {
\tresult := make([]byte, len(data))
\tfor i := 0; i < len(data); i++ {
\t\tresult[i] = data[i] ^ key[i%len(key)]
\t}
\treturn string(result)
}

func main() {
\t${keyVar} := []byte{${key.join(', ')}}
\t${dataVar} := []byte{${xorEncoded.join(', ')}}

\tdecoded := ${funcName}(${dataVar}, ${keyVar})
\tpayload, _ := base64.StdEncoding.DecodeString(decoded)
\tfmt.Println("// Decrypted Go payload:")
\tfmt.Println(string(payload))
}
`
}
