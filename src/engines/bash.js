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

import { toBase64 } from '../utils/encoding'
import { randomVarName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, isSafeForInjection } from '../utils/parser'

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

  return transformCodeOnly(code, 'bash', (codeSegment) => {
    let result = codeSegment
    const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
    for (const varName of sortedVars) {
      const assignRegex = new RegExp('\\b' + varName + '=', 'g')
      const useRegex = new RegExp('\\$' + varName + '\\b', 'g')
      const braceRegex = new RegExp('\\$\\{' + varName + '\\}', 'g')
      result = result.replace(assignRegex, varMap[varName] + '=')
      result = result.replace(braceRegex, '${' + varMap[varName] + '}')
      result = result.replace(useRegex, '$' + varMap[varName])
    }

    // Command obfuscation: replace known commands with printf hex
    for (const cmd of OBFUSCATABLE_COMMANDS) {
      // Only replace at word boundaries when used as commands (start of line/pipe/subshell)
      const cmdRegex = new RegExp('(?<=^|\\||;|\\$\\(|`)\\s*' + cmd + '\\b', 'gm')
      result = result.replace(cmdRegex, (match) => {
        const leadingSpace = match.match(/^\s*/)?.[0] || ''
        return leadingSpace + obfuscateCommand(cmd)
      })
    }

    return result
  })
}

/* ── String Encoding (native Linux only) ─────────────────── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'bash')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    // Skip ANSI-C strings ($'...')
    if (quoteChar === "$'") {
      return `$'${content}'`
    }

    // Skip single-quoted (literal in bash)
    if (quoteChar === "'") {
      return `'${content}'`
    }

    // Unicode → force Base64
    if (hasUnicode(content)) {
      const b64 = toBase64(content)
      return `$(echo "${b64}" | base64 -d)`
    }

    // ASCII: choose native bash method
    const method = Math.floor(Math.random() * 3)
    switch (method) {
      case 0: {
        // printf hex: $(printf '\xHH\xHH')
        const hex = Array.from(content)
          .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
        return `$(printf '${hex}')`
      }
      case 1: {
        // Octal: $'\NNN\NNN'
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
        return `"${content}"`
    }
  })

  return tokensToCode(transformed)
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
