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

import { toBase64, xorEncryptForLanguage } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, isSafeForInjection } from '../utils/parser'

export function obfuscatePython(code, layers = []) {
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

  const transformed = transformStrings(tokens, (content, quoteChar, prefix) => {
    // Skip triple-quoted strings — never obfuscate
    if (quoteChar === '"""' || quoteChar === "'''") {
      return `${quoteChar}${content}${quoteChar}`
    }

    // b-strings: keep as bytes literal (don't encode)
    const lowerPrefix = (prefix || '').toLowerCase()
    if (lowerPrefix === 'b' || lowerPrefix === 'br' || lowerPrefix === 'rb') {
      return `b"${content}"`
    }

    // f-strings, r-strings, u-strings: STRIP prefix completely
    // The obfuscated form doesn't need any prefix (f/r/u are all irrelevant after encoding)

    // Unicode → force Base64 via getattr (stealth, no direct attribute access)
    if (hasUnicode(content)) {
      const b64 = toBase64(content)
      return `getattr(__import__("base64"), "b64decode")("${b64}").decode("utf-8")`
    }

    // ASCII: choose safe method (NO f-strings, NO prefixes, getattr for base64)
    const method = Math.floor(Math.random() * 3)
    switch (method) {
      case 0: {
        // bytes hex decode: b'\xHH\xHH'.decode()
        const hex = Array.from(content)
          .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
        return `b"${hex}".decode()`
      }
      case 1: {
        // bytes.fromhex().decode() — clean, no imports needed
        const hexStr = Array.from(content)
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
        return `bytes.fromhex("${hexStr}").decode()`
      }
      case 2: {
        // getattr base64 decode (stealth)
        const b64 = toBase64(content)
        return `getattr(__import__("base64"), "b64decode")("${b64}").decode()`
      }
      default:
        return `"${content}"`
    }
  })

  return tokensToCode(transformed)
}

/* ── XOR String Encryption (Platinum) ────────────────────── */

function applyXorStringEncryption(code) {
  const funcName = '_' + randomVarName('snake_case')
  let helperInjected = false
  const tokens = tokenize(code, 'python')

  const transformed = transformStrings(tokens, (content, quoteChar, prefix) => {
    if (quoteChar === '"""' || quoteChar === "'''") return `${quoteChar}${content}${quoteChar}`
    const lp = (prefix || '').toLowerCase()
    if (lp === 'b' || lp === 'br' || lp === 'rb') return `b"${content}"`
    if (content.length < 3) return `"${content}"`

    const xor = xorEncryptForLanguage(content, 'python', funcName)
    if (!helperInjected) helperInjected = true
    return xor.inline
  })

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'python', funcName).helper
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

/* ── Polymorphic Encryption Wrapper (v4.5) ───────────────── */

function generatePyJunk() {
  const junkPool = [
    () => { const v = randomVarName('snake_case'); return `${v} = (${Math.floor(Math.random()*999)} * ${Math.floor(Math.random()*99)} + ${Math.floor(Math.random()*9999)}) % 256` },
    () => `_ = [x for x in range(${2 + Math.floor(Math.random()*5)}) if x > ${10 + Math.floor(Math.random()*90)}]`,
    () => { const v = randomVarName('snake_case'); return `${v} = sum(range(${Math.floor(Math.random()*20)})) ^ ${Math.floor(Math.random()*0xFFFF)}` },
    () => `_ = bytes([${Math.floor(Math.random()*256)}, ${Math.floor(Math.random()*256)}, ${Math.floor(Math.random()*256)}])`,
    () => { const v = randomVarName('snake_case'); return `${v} = len(str(${Math.floor(Math.random()*999999)})) + ${Math.floor(Math.random()*100)}` },
  ]
  return junkPool[Math.floor(Math.random() * junkPool.length)]()
}

function generatePyLoopJunk(iterVar) {
  const pool = [
    () => `        _ = (${iterVar} * ${3 + Math.floor(Math.random()*17)} + ${Math.floor(Math.random()*255)}) % 256`,
    () => `        _ = ${iterVar} ^ ${Math.floor(Math.random()*0xFF)}`,
    () => `        _ = (${iterVar} >> ${1 + Math.floor(Math.random()*3)}) | ${Math.floor(Math.random()*128)}`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Stealth Execution (v4.7) ────────────────────────────── */

function stealthExec(payloadExpr) {
  const methods = [
    // compile + exec (code object)
    () => `exec(compile(${payloadExpr}, '<module>', 'exec'))`,
    // __builtins__ indirect lookup
    () => `getattr(__builtins__, '__dict__', __builtins__)['exec'](${payloadExpr})`,
    // types.FunctionType
    () => `(lambda c: __import__('types').FunctionType(compile(c, '', 'exec'), {})())(${payloadExpr})`,
  ]
  return methods[Math.floor(Math.random() * methods.length)]()
}

function applyEncryptionWrapper(code) {
  const method = Math.floor(Math.random() * 4)
  switch (method) {
    case 0: return pyWrapperXorB64(code)
    case 1: return pyWrapperHexShift(code)
    case 2: return pyWrapperMultiXor(code)
    case 3: return pyWrapperByteRotation(code)
    default: return pyWrapperXorB64(code)
  }
}

/* Method 1: XOR + Base64 (polymorphic) */
function pyWrapperXorB64(code) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorData = Array.from(b64).map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  const dv = randomVarName('snake_case')
  const kv = randomVarName('snake_case')
  const fv = randomVarName('snake_case')
  const rv = randomVarName('snake_case')
  const iv = randomVarName('snake_case')

  const loopJunk1 = generatePyLoopJunk(iv)
  const loopJunk2 = generatePyLoopJunk(iv)

  const funcBody = `def ${fv}(${dv}, ${kv}):
    ${rv} = []
    for ${iv} in range(len(${dv})):
${loopJunk1}
        ${rv}.append(chr(${dv}[${iv}] ^ ${kv}[${iv} % len(${kv})]))
${loopJunk2}
    return ''.join(${rv})`

  const dataDecl = `${dv} = [${xorData.join(',')}]`
  const keyDecl = `${kv} = [${key.join(',')}]`

  const initParts = shuffleArray([dataDecl, keyDecl, generatePyJunk(), generatePyJunk()])
  const execLine = stealthExec(`getattr(__import__("base64"), "b64decode")(${fv}(${dv}, ${kv})).decode()`)

  // Randomly place func before or after inits
  const funcFirst = Math.random() > 0.5
  const lines = funcFirst
    ? [funcBody, '', ...initParts, '', execLine]
    : [...initParts, '', funcBody, '', execLine]

  return lines.join('\n') + '\n'
}

/* Method 2: Hex-Shift */
function pyWrapperHexShift(code) {
  const shift = 3 + Math.floor(Math.random() * 25)
  const hexStr = Array.from(code).map(c => ((c.charCodeAt(0) + shift) % 256).toString(16).padStart(2, '0')).join('')

  const dv = randomVarName('snake_case')
  const sv = randomVarName('snake_case')
  const fv = randomVarName('snake_case')
  const rv = randomVarName('snake_case')
  const iv = randomVarName('snake_case')

  const funcBody = `def ${fv}(${dv}, ${sv}):
    ${rv} = []
    for ${iv} in range(0, len(${dv}), 2):
        ${rv}.append(chr((int(${dv}[${iv}:${iv}+2], 16) - ${sv}) % 256))
${generatePyLoopJunk(iv)}
    return ''.join(${rv})`

  const initParts = shuffleArray([
    `${dv} = "${hexStr}"`,
    `${sv} = ${shift}`,
    generatePyJunk(),
  ])

  return [...initParts, '', funcBody, '', stealthExec(`${fv}(${dv}, ${sv})`)].join('\n') + '\n'
}

/* Method 3: Multi-XOR (2-key chain) */
function pyWrapperMultiXor(code) {
  const key1 = randomXorKey(16)
  const key2 = randomXorKey(16)
  const encoded = Array.from(code).map((c, i) => (c.charCodeAt(0) ^ key1[i % key1.length]) ^ key2[i % key2.length])

  const dv = randomVarName('snake_case')
  const k1v = randomVarName('snake_case')
  const k2v = randomVarName('snake_case')
  const fv = randomVarName('snake_case')
  const iv = randomVarName('snake_case')

  const funcBody = `def ${fv}(${dv}, ${k1v}, ${k2v}):
    ${randomVarName('snake_case')} = []
    for ${iv} in range(len(${dv})):
${generatePyLoopJunk(iv)}
        ${randomVarName('snake_case')}.append(chr((${dv}[${iv}] ^ ${k2v}[${iv} % len(${k2v})]) ^ ${k1v}[${iv} % len(${k1v})]))
    return ''.join(${randomVarName('snake_case')})`

  // Fix: use consistent var for result
  const rr = randomVarName('snake_case')
  const fixedFunc = `def ${fv}(${dv}, ${k1v}, ${k2v}):
    ${rr} = []
    for ${iv} in range(len(${dv})):
${generatePyLoopJunk(iv)}
        ${rr}.append(chr((${dv}[${iv}] ^ ${k2v}[${iv} % len(${k2v})]) ^ ${k1v}[${iv} % len(${k1v})]))
    return ''.join(${rr})`

  const initParts = shuffleArray([
    `${dv} = [${encoded.join(',')}]`,
    `${k1v} = [${key1.join(',')}]`,
    `${k2v} = [${key2.join(',')}]`,
    generatePyJunk(),
    generatePyJunk(),
  ])

  return [...initParts, '', fixedFunc, '', stealthExec(`${fv}(${dv}, ${k1v}, ${k2v})`)].join('\n') + '\n'
}

/* Method 4: Byte Rotation */
function pyWrapperByteRotation(code) {
  const rotN = 3 + Math.floor(Math.random() * 50)
  const b64 = toBase64(code)
  const rotated = Array.from(b64).map(c => (c.charCodeAt(0) + rotN) % 256)

  const dv = randomVarName('snake_case')
  const nv = randomVarName('snake_case')
  const fv = randomVarName('snake_case')
  const iv = randomVarName('snake_case')
  const rv = randomVarName('snake_case')

  const funcBody = `def ${fv}(${dv}, ${nv}):
    ${rv} = []
    for ${iv} in range(len(${dv})):
        ${rv}.append(chr((${dv}[${iv}] - ${nv}) % 256))
${generatePyLoopJunk(iv)}
    return ''.join(${rv})`

  const initParts = shuffleArray([
    `${dv} = [${rotated.join(',')}]`,
    `${nv} = ${rotN}`,
    generatePyJunk(),
    generatePyJunk(),
  ])

  return [`import base64`, ...initParts, '', funcBody, '',
    stealthExec(`getattr(__import__("base64"), "b64decode")(${fv}(${dv}, ${nv})).decode()`)
  ].join('\n') + '\n'
}
