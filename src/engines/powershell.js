/**
 * PowerShell Obfuscation Engine
 * Techniques: String splitting, Base64, tick insertion, variable randomization,
 * format operator, Invoke-Expression tricks, dead code, encryption wrapper.
 */

import { toBase64 } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'

/**
 * Apply all active obfuscation layers to PowerShell code
 * @param {string} code - Original PowerShell code
 * @param {string[]} layers - Active layer IDs
 * @returns {string} Obfuscated code
 */
export function obfuscatePowerShell(code, layers = []) {
  if (!code || code.trim().length === 0) return ''

  let result = code

  // Apply layers in order
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
  // Find all PowerShell variables ($varName)
  const varPattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
  const reserved = new Set([
    'null', 'true', 'false', 'args', 'input', 'PSCommandPath',
    'PSScriptRoot', 'MyInvocation', 'ErrorActionPreference', '_',
    'env', 'Host', 'PWD', 'HOME', 'PSVersionTable',
  ])

  const varMap = {}
  let match
  while ((match = varPattern.exec(code)) !== null) {
    const varName = match[1]
    if (!reserved.has(varName) && !varMap[varName]) {
      varMap[varName] = randomVarName('short')
    }
  }

  let result = code
  // Replace longest names first to avoid partial replacements
  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
  for (const varName of sortedVars) {
    const regex = new RegExp('\\$' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    result = result.replace(regex, '$' + varMap[varName])
  }

  return result
}

function applyStringEncoding(code) {
  // Encode quoted strings using char array concatenation
  const stringPattern = /"([^"]{3,})"/g

  return code.replace(stringPattern, (match, content) => {
    // Randomly choose encoding method
    const method = Math.floor(Math.random() * 3)

    switch (method) {
      case 0: {
        // Char code concatenation: [char]65+[char]66...
        const chars = Array.from(content)
          .map((c) => `[char]${c.charCodeAt(0)}`)
          .join('+')
        return `(${chars})`
      }
      case 1: {
        // Format operator: ("{0}{1}{2}" -f "part1","part2","part3")
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
        // String reverse + -join
        const reversed = content.split('').reverse().join('')
        return `(-join("${reversed}"[-1..-(${content.length})]))`
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
    // Insert dead code every 3-5 lines
    if (i > 0 && i % (3 + Math.floor(Math.random() * 3)) === 0) {
      result.push(generateDeadCode('powershell'))
    }
  }

  return result.join('\n')
}

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

function applyEncryptionWrapper(code) {
  const key = randomXorKey(16)
  const encoded = toBase64(code)
  const keyVar = randomVarName('short')
  const dataVar = randomVarName('short')
  const decodedVar = randomVarName('short')
  const funcName = randomFuncName()

  // Simple Base64 + XOR wrapper
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
IEX([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($${decodedVar})))
`
}
