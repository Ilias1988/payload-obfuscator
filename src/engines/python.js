/**
 * Python Obfuscation Engine
 * Techniques: exec/eval wrapping, base64+zlib, chr() encoding,
 * lambda chains, __import__ tricks, variable randomization.
 */

import { toBase64 } from '../utils/encoding'
import { randomVarName, generateDeadCode, randomXorKey } from '../utils/randomization'

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

function applyVariableRandomization(code) {
  const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g
  const reserved = new Set([
    'import', 'from', 'as', 'def', 'class', 'return', 'if', 'else', 'elif',
    'while', 'for', 'in', 'try', 'except', 'finally', 'with', 'pass', 'break',
    'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'lambda',
    'self', 'print', 'range', 'len', 'str', 'int', 'float', 'list', 'dict',
    'tuple', 'set', 'type', 'os', 'sys', 'socket', 'subprocess', '__name__',
    '__import__', '__builtins__', 'exec', 'eval', 'open', 'input', 'super',
  ])

  const varMap = {}
  let match
  while ((match = varPattern.exec(code)) !== null) {
    const varName = match[1]
    if (!reserved.has(varName) && !varMap[varName] && varName.length > 1) {
      varMap[varName] = randomVarName('snake_case')
    }
  }

  let result = code
  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
  for (const varName of sortedVars) {
    const regex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
    result = result.replace(regex, varMap[varName])
  }

  return result
}

function applyStringEncoding(code) {
  const stringPattern = /(["'])([^"']{3,})\1/g

  return code.replace(stringPattern, (match, quote, content) => {
    const method = Math.floor(Math.random() * 3)

    switch (method) {
      case 0: {
        // chr() concatenation
        const chars = Array.from(content)
          .map((c) => `chr(${c.charCodeAt(0)})`)
          .join('+')
        return `(${chars})`
      }
      case 1: {
        // bytes decode
        const hex = Array.from(content)
          .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
        return `b"${hex}".decode()`
      }
      case 2: {
        // Base64 inline
        const b64 = toBase64(content)
        return `__import__("base64").b64decode("${b64}").decode()`
      }
      default:
        return match
    }
  })
}

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i])
    if (i > 0 && i % (3 + Math.floor(Math.random() * 3)) === 0) {
      result.push(generateDeadCode('python'))
    }
  }

  return result.join('\n')
}

function applyAntiAnalysis(code) {
  const v1 = randomVarName('snake_case')
  const v2 = randomVarName('snake_case')
  const sleepSec = 1 + Math.floor(Math.random() * 4)

  return `import time as ${v1}, os as ${v2}
# Anti-analysis checks
if ${v2}.cpu_count() is not None and ${v2}.cpu_count() < 2:
    ${v2}._exit(0)
${v1}.sleep(${sleepSec})
try:
    import sys
    if hasattr(sys, 'gettrace') and sys.gettrace() is not None:
        ${v2}._exit(0)
except:
    pass

${code}`
}

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
