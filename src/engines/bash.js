/**
 * Bash Obfuscation Engine
 * Techniques: Variable substitution, hex encoding, eval+base64,
 * IFS manipulation, dead code injection, encryption wrapper.
 */

import { toBase64 } from '../utils/encoding'
import { randomVarName, generateDeadCode, randomXorKey } from '../utils/randomization'

export function obfuscateBash(code, layers = []) {
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
  const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)=/g
  const reserved = new Set([
    'if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'case',
    'esac', 'function', 'return', 'exit', 'echo', 'printf', 'read',
    'export', 'local', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'IFS',
    'PWD', 'OLDPWD', 'BASH', 'BASH_VERSION', 'RANDOM', 'SECONDS',
  ])

  const varMap = {}
  let match
  while ((match = varPattern.exec(code)) !== null) {
    const varName = match[1]
    if (!reserved.has(varName) && !varMap[varName] && varName.length > 1) {
      varMap[varName] = randomVarName('short').toLowerCase()
    }
  }

  let result = code
  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
  for (const varName of sortedVars) {
    // Replace both assignment and usage ($var)
    const assignRegex = new RegExp('\\b' + varName + '=', 'g')
    const useRegex = new RegExp('\\$' + varName + '\\b', 'g')
    const braceRegex = new RegExp('\\$\\{' + varName + '\\}', 'g')
    result = result.replace(assignRegex, varMap[varName] + '=')
    result = result.replace(braceRegex, '${' + varMap[varName] + '}')
    result = result.replace(useRegex, '$' + varMap[varName])
  }

  return result
}

function applyStringEncoding(code) {
  const stringPattern = /"([^"]{3,})"/g

  return code.replace(stringPattern, (match, content) => {
    const method = Math.floor(Math.random() * 3)

    switch (method) {
      case 0: {
        // Hex encoding with printf
        const hex = Array.from(content)
          .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
        return `$(printf "${hex}")`
      }
      case 1: {
        // Octal encoding
        const octal = Array.from(content)
          .map((c) => '\\' + c.charCodeAt(0).toString(8).padStart(3, '0'))
          .join('')
        return `$'${octal}'`
      }
      case 2: {
        // Base64 inline
        const b64 = toBase64(content)
        return `$(echo "${b64}" | base64 -d)`
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
    if (i > 0 && i % (2 + Math.floor(Math.random() * 3)) === 0) {
      result.push(generateDeadCode('bash'))
    }
  }

  return result.join('\n')
}

function applyAntiAnalysis(code) {
  const v1 = randomVarName('short').toLowerCase()
  const sleepSec = 1 + Math.floor(Math.random() * 3)

  return `#!/bin/bash
# Environment validation
${v1}=$(nproc 2>/dev/null || echo 1)
[ "$${v1}" -lt 2 ] && exit 0
sleep ${sleepSec}
if [ -f /proc/self/status ]; then
  grep -qi "TracerPid:[[:space:]]*[1-9]" /proc/self/status && exit 0
fi

${code}`
}

function applyEncryptionWrapper(code) {
  const b64 = toBase64(code)
  const keyVar = randomVarName('short').toLowerCase()

  return `#!/bin/bash
# Encrypted payload
${keyVar}="${b64}"
eval "$(echo "$${keyVar}" | base64 -d)"
`
}
