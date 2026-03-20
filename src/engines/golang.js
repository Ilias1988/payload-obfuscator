/**
 * Go Obfuscation Engine
 * Techniques: Byte array payloads, XOR runtime decryption,
 * string building, variable randomization, dead code.
 */

import { toBase64 } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'

export function obfuscateGo(code, layers = []) {
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
  const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/g
  const reserved = new Set([
    'main', 'func', 'var', 'const', 'type', 'struct', 'interface',
    'package', 'import', 'return', 'if', 'else', 'for', 'range',
    'switch', 'case', 'default', 'break', 'continue', 'go', 'chan',
    'defer', 'select', 'nil', 'true', 'false', 'err', 'fmt',
    'os', 'net', 'exec', 'io', 'strings', 'strconv', 'bytes',
  ])

  const varMap = {}
  let match
  while ((match = varPattern.exec(code)) !== null) {
    const varName = match[1]
    if (!reserved.has(varName) && !varMap[varName] && varName.length > 1 && varName !== '_') {
      varMap[varName] = randomVarName('camelCase')
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
  const stringPattern = /"([^"]{3,})"/g

  return code.replace(stringPattern, (match, content) => {
    const method = Math.floor(Math.random() * 2)

    switch (method) {
      case 0: {
        // Byte slice to string
        const bytes = Array.from(content)
          .map((c) => c.charCodeAt(0))
          .join(', ')
        return `string([]byte{${bytes}})`
      }
      case 1: {
        // String builder
        const funcName = randomFuncName()
        // Inline approach
        const chars = Array.from(content)
          .map((c) => `${c.charCodeAt(0)}`)
          .join(', ')
        return `func() string { b := []byte{${chars}}; return string(b) }()`
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
    if (i > 0 && i % (4 + Math.floor(Math.random() * 3)) === 0 && !lines[i].trim().startsWith('import') && !lines[i].trim().startsWith('package')) {
      result.push('\t' + generateDeadCode('go'))
    }
  }

  return result.join('\n')
}

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

  // Add runtime and time imports if not present
  let result = code
  if (!result.includes('"runtime"')) {
    result = result.replace(
      /import \(/,
      'import (\n\t"runtime"\n\t"time"'
    )
  }

  // Insert after func main() {
  const mainIndex = result.indexOf('func main()')
  if (mainIndex !== -1) {
    const braceIndex = result.indexOf('{', mainIndex)
    if (braceIndex !== -1) {
      return result.substring(0, braceIndex + 1) + '\n' + antiAnalysis + '\n' + result.substring(braceIndex + 1)
    }
  }

  return result
}

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
