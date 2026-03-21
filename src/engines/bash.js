/**
 * Bash Obfuscation Engine (v2 — Context-Aware)
 *
 * FIXED:
 * - ONLY native Linux commands: $(printf '\xXX'), $(echo|base64 -d)
 * - NO Python-style __import__, chr(), or non-bash constructs
 * - Command obfuscation: cat → $(printf '\x63\x61\x74')
 * - Context-aware string encoding
 * - Unicode → force Base64
 */

import { toBase64, xorEncryptForLanguage } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, hasInterpolation, splitInterpolatedString, isSafeForInjection } from '../utils/parser'

export function obfuscateBash(code, layers = []) {
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

/* ── Variable Randomization + Command Obfuscation ────────── */

const OBFUSCATABLE_COMMANDS = [
  'cat', 'curl', 'wget', 'nc', 'ncat', 'netcat', 'bash', 'sh', 'python', 'python3',
  'perl', 'ruby', 'php', 'nmap', 'chmod', 'chown', 'mkdir', 'touch', 'rm',
  'cp', 'mv', 'find', 'grep', 'awk', 'sed', 'xargs', 'tar', 'gzip',
  'whoami', 'id', 'uname', 'hostname', 'ifconfig', 'ip', 'ss', 'netstat',
  'ps', 'kill', 'pkill', 'crontab', 'dd', 'openssl', 'socat',
  'systemctl', 'iptables', 'mount', 'umount', 'useradd', 'groupadd',
  'chattr', 'lsattr', 'tcpdump', 'strace', 'ltrace', 'strings',
]

function obfuscateCommand(cmd) {
  const hex = Array.from(cmd)
    .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
  return `$(printf '${hex}')`
}

function applyVariableRandomization(code) {
  const reserved = new Set([
    'if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'case',
    'esac', 'function', 'return', 'exit', 'echo', 'printf', 'read',
    'export', 'local', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'IFS',
    'PWD', 'OLDPWD', 'BASH', 'BASH_VERSION', 'RANDOM', 'SECONDS',
    'HOSTNAME', 'LANG', 'LC_ALL', 'COLUMNS', 'LINES', 'PPID', 'UID',
  ])

  // Collect variables from CODE tokens
  const tokens = tokenize(code, 'bash')
  const varMap = {}

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)=/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !varMap[varName] && varName.length > 1) {
        varMap[varName] = randomVarName('short').toLowerCase()
      }
    }
  }

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename $vars in text
  const renameVarsInText = (text) => {
    let result = text
    for (const varName of sortedVars) {
      const braceRegex = new RegExp('\\$\\{' + varName + '\\}', 'g')
      const useRegex = new RegExp('\\$' + varName + '\\b', 'g')
      result = result.replace(braceRegex, '${' + varMap[varName] + '}')
      result = result.replace(useRegex, '$' + varMap[varName])
    }
    return result
  }

  // Helper: rename in code (includes assignments + commands)
  const renameInCode = (codeSegment) => {
    let result = codeSegment
    for (const varName of sortedVars) {
      const assignRegex = new RegExp('\\b' + varName + '=', 'g')
      result = result.replace(assignRegex, varMap[varName] + '=')
    }
    result = renameVarsInText(result)
    // Command obfuscation
    for (const cmd of OBFUSCATABLE_COMMANDS) {
      const cmdRegex = new RegExp('(?<=^|\\||;|\\$\\(|`)\\s*' + cmd + '\\b', 'gm')
      result = result.replace(cmdRegex, (match) => {
        const leadingSpace = match.match(/^\s*/)?.[0] || ''
        return leadingSpace + obfuscateCommand(cmd)
      })
    }
    return result
  }

  // Process ALL tokens: code + interpolated double-quoted strings
  const transformed = tokens.map(token => {
    if (token.type === 'code') {
      return { ...token, value: renameInCode(token.value) }
    }
    // Rename inside double-quoted strings (bash interpolates these)
    if (token.type === 'string' && token.quoteChar === '"') {
      const newValue = renameVarsInText(token.value)
      return { ...token, value: newValue, raw: `"${newValue}"` }
    }
    return token
  })

  return tokensToCode(transformed)
}

/* ── Encode a single static text segment for Bash ────────── */

function encodeStaticBash(text) {
  if (!text) return ''
  if (hasUnicode(text)) {
    return `$(echo "${toBase64(text)}" | base64 -d)`
  }
  const method = Math.floor(Math.random() * 2)
  if (method === 0) {
    const hex = Array.from(text).map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    return `$(printf '${hex}')`
  }
  return `$(echo "${toBase64(text)}" | base64 -d)`
}

/* ── String Encoding (interpolation-aware, native Linux) ─── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'bash')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    if (quoteChar === "$'") return `$'${content}'`
    if (quoteChar === "'") return `'${content}'`

    // Interpolation-aware: split into static + variable segments
    if (hasInterpolation(content, 'bash')) {
      const segments = splitInterpolatedString(content, 'bash')
      // Build: "encoded_static$var encoded_static2"
      const parts = segments.map(seg => {
        if (seg.type === 'var') return seg.value // Leave $var, $(cmd) intact
        if (seg.value.length === 0) return ''
        return encodeStaticBash(seg.value)
      }).filter(p => p.length > 0)
      return parts.join('')
    }

    // No interpolation — encode entire string
    return encodeStaticBash(content)
  })

  return tokensToCode(transformed)
}

/* ── XOR String Encryption (interpolation-aware) ─────────── */

function applyXorStringEncryption(code) {
  const funcName = '_xd_' + randomVarName('short').toLowerCase()
  let helperInjected = false
  const tokens = tokenize(code, 'bash')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    if (quoteChar === "$'" || quoteChar === "'") {
      return quoteChar === "'" ? `'${content}'` : `$'${content}'`
    }
    if (content.length < 3) return `"${content}"`

    // Interpolation-aware XOR
    if (hasInterpolation(content, 'bash')) {
      const segments = splitInterpolatedString(content, 'bash')
      const parts = segments.map(seg => {
        if (seg.type === 'var') return seg.value
        if (seg.value.length < 3) return seg.value
        const xor = xorEncryptForLanguage(seg.value, 'bash', funcName)
        if (!helperInjected) helperInjected = true
        return xor.inline
      }).filter(p => p.length > 0)
      return parts.join('')
    }

    const xor = xorEncryptForLanguage(content, 'bash', funcName)
    if (!helperInjected) helperInjected = true
    return xor.inline
  })

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'bash', funcName).helper
    result = helper + '\n' + result
  }
  return result
}

/* ── Dead Code Injection ─────────────────────────────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i])
    if (i > 0 && i % (2 + Math.floor(Math.random() * 3)) === 0) {
      if (isSafeForInjection(lines[i], 'bash')) {
        result.push(generateDeadCode('bash'))
      }
    }
  }

  return result.join('\n')
}

/* ── Anti-Analysis ───────────────────────────────────────── */

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

/* ── Encryption Wrapper ──────────────────────────────────── */

function applyEncryptionWrapper(code) {
  const b64 = toBase64(code)
  const keyVar = randomVarName('short').toLowerCase()

  return `#!/bin/bash
# Encrypted payload
${keyVar}="${b64}"
eval "$(echo "$${keyVar}" | base64 -d)"
`
}
