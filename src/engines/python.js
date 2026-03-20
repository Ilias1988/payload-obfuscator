/**
 * Python Obfuscation Engine (v2 — Context-Aware)
 *
 * FIXED:
 * - Context-aware: variables renamed ONLY in code segments, not strings
 * - No f-strings in obfuscated output (causes syntax errors with chr())
 * - Uses b'\xXX'.decode() or base64.b64decode() only
 * - Never obfuscates inside triple-quoted strings
 * - Unicode → force Base64
 */

import { toBase64 } from '../utils/encoding'
import { randomVarName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, isSafeForInjection } from '../utils/parser'

export function obfuscatePython(code, layers = []) {
  if (!code || code.trim().length === 0) return ''

  let result = code

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

  return result
}

/* ── Variable Randomization (context-aware) ──────────────── */

function applyVariableRandomization(code) {
  const reserved = new Set([
    'import', 'from', 'as', 'def', 'class', 'return', 'if', 'else', 'elif',
    'while', 'for', 'in', 'try', 'except', 'finally', 'with', 'pass', 'break',
    'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'lambda',
    'self', 'print', 'range', 'len', 'str', 'int', 'float', 'list', 'dict',
    'tuple', 'set', 'type', 'os', 'sys', 'socket', 'subprocess', '__name__',
    '__import__', '__builtins__', 'exec', 'eval', 'open', 'input', 'super',
    'yield', 'del', 'global', 'nonlocal', 'assert', 'raise', 'async', 'await',
    'bytes', 'map', 'filter', 'zip', 'enumerate', 'sorted', 'reversed',
    'base64', 'time', 'struct', 'ctypes', 'threading', 'multiprocessing',
  ])

  // Collect variable assignments from CODE tokens only
  const tokens = tokenize(code, 'python')
  const varMap = {}

  for (const token of tokens) {
    if (token.type !== 'code') continue
    // Match: varname = (but NOT ==)
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=[^=]/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !varMap[varName] && varName.length > 1 &&
          !varName.startsWith('__') && !/^[A-Z_]+$/.test(varName)) {
        varMap[varName] = randomVarName('snake_case')
      }
    }
  }

  if (Object.keys(varMap).length === 0) return code

  // Replace ONLY in code tokens
  return transformCodeOnly(code, 'python', (codeSegment) => {
    let result = codeSegment
    const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
    for (const varName of sortedVars) {
      const regex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      result = result.replace(regex, varMap[varName])
    }
    return result
  })
}

/* ── String Encoding (context-aware, no f-strings) ───────── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'python')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    // Skip triple-quoted strings — never obfuscate
    if (quoteChar === '"""' || quoteChar === "'''") {
      return `${quoteChar}${content}${quoteChar}`
    }

    // Unicode → force Base64
    if (hasUnicode(content)) {
      const b64 = toBase64(content)
      return `__import__("base64").b64decode("${b64}").decode("utf-8")`
    }

    // ASCII: choose safe method (NO f-strings, NO chr() mixing)
    const method = Math.floor(Math.random() * 2)
    switch (method) {
      case 0: {
        // bytes hex decode: b'\xHH\xHH'.decode()
        const hex = Array.from(content)
          .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
        return `b"${hex}".decode()`
      }
      case 1: {
        // base64 inline
        const b64 = toBase64(content)
        return `__import__("base64").b64decode("${b64}").decode()`
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
      if (isSafeForInjection(lines[i], 'python')) {
        // Match indentation of current line
        const indent = lines[i].match(/^(\s*)/)?.[1] || ''
        result.push(indent + generateDeadCode('python'))
      }
    }
  }

  return result.join('\n')
}

/* ── Anti-Analysis ───────────────────────────────────────── */

function applyAntiAnalysis(code) {
  const v1 = randomVarName('snake_case')
  const v2 = randomVarName('snake_case')
  const sleepSec = 1 + Math.floor(Math.random() * 4)

  return `import time as ${v1}
import os as ${v2}
# Anti-analysis checks
if ${v2}.cpu_count() is not None and ${v2}.cpu_count() < 2:
    ${v2}._exit(0)
${v1}.sleep(${sleepSec})
try:
    import sys
    if hasattr(sys, 'gettrace') and sys.gettrace() is not None:
        ${v2}._exit(0)
except Exception:
    pass

${code}`
}

/* ── Encryption Wrapper ──────────────────────────────────── */

function applyEncryptionWrapper(code) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorEncoded = Array.from(b64)
    .map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  const dataVar = randomVarName('snake_case')
  const keyVar = randomVarName('snake_case')
  const funcVar = randomVarName('snake_case')

  return `import base64
${keyVar} = [${key.join(',')}]
${dataVar} = [${xorEncoded.join(',')}]

def ${funcVar}(d, k):
    return ''.join(chr(d[i] ^ k[i % len(k)]) for i in range(len(d)))

exec(base64.b64decode(${funcVar}(${dataVar}, ${keyVar})).decode())
`
}
