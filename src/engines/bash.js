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

import { toBase64, xorEncryptForLanguage } from '../utils/encoding.js'
import { randomVarName, generateDeadCode, randomXorKey } from '../utils/randomization.js'
import { tokenize, tokensToCode, transformStrings, hasUnicode, hasInterpolation, splitInterpolatedString, isSafeForInjection } from '../utils/parser.js'

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

function bashTokenRaw(token) {
  if (token.type !== 'string') return token.value
  return token.raw || `${token.quoteChar}${token.value}${token.quoteChar}`
}

function maskBashNonCode(code) {
  return tokenize(code, 'bash').map((token) => {
    if (token.type === 'code') return token.value
    return bashTokenRaw(token).replace(/[^\r\n]/g, ' ')
  }).join('')
}

function insertBashPreamble(code, preamble) {
  const match = /^(#![^\r\n]*(?:\r?\n)?)/.exec(code)
  if (!match) return `${preamble}\n${code}`
  return `${match[1]}${preamble}\n${code.slice(match[1].length)}`
}

function transformArithmeticRegions(text, transform) {
  let output = ''
  let cursor = 0

  while (cursor < text.length) {
    const dollarStart = text.indexOf('$((', cursor)
    const plainStart = text.indexOf('((', cursor)
    let start = -1
    let openerLength = 0
    if (dollarStart !== -1 && (plainStart === -1 || dollarStart <= plainStart)) {
      start = dollarStart
      openerLength = 3
    } else if (plainStart !== -1) {
      start = plainStart
      openerLength = 2
    }
    if (start === -1) {
      output += text.slice(cursor)
      break
    }

    output += text.slice(cursor, start + openerLength)
    let depth = 2
    let end = start + openerLength
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++
      else if (text[end] === ')' && --depth === 0) break
    }
    if (depth !== 0) {
      output += text.slice(start + openerLength)
      break
    }

    output += transform(text.slice(start + openerLength, end - 1)) + '))'
    cursor = end + 1
  }

  return output
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

  // Indirection and runtime-loaded shell code depend on identifier spellings.
  // Without a full Bash scope/AST model, renaming must safely become a no-op.
  if (/\b(?:eval|source)\b|(?:declare|local|typeset)\s+-[a-zA-Z]*n|\$\{!/.test(code)) {
    return code
  }

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)=/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !/^[A-Z_][A-Z0-9_]*$/.test(varName) && !varMap[varName] && varName.length > 1) {
        varMap[varName] = randomVarName('short').toLowerCase()
      }
    }
  }

  // Do not rename a variable referenced inside a single-quoted data/code
  // string because Bash does not interpolate it there.
  for (const token of tokens) {
    if (token.type !== 'string' || token.quoteChar !== "'") continue
    for (const varName of Object.keys(varMap)) {
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\$${escaped}\\b|\\$\\{[!#]?${escaped}(?=[^a-zA-Z0-9_]|$)`).test(token.value)) {
        delete varMap[varName]
      }
    }
  }

  // Several Bash builtins take variable names as bare words rather than
  // expansions. Protect those names unless a full shell AST is available.
  const maskedCode = maskBashNonCode(code)
  for (const varName of Object.keys(varMap)) {
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const bareTargetPatterns = [
      new RegExp(`\\b(?:for|select)\\s+${escaped}\\b`),
      new RegExp(`\\bprintf\\s+-v\\s+${escaped}\\b`),
      new RegExp(`\\b(?:read|mapfile|readarray|getopts)\\b[^\\r\\n;]*\\b${escaped}\\b`),
      new RegExp(`\\bunset\\s+(?:-[^\\s]+\\s+)*${escaped}\\b`),
      new RegExp(`\\b(?:export|readonly|local|declare|typeset)\\s+(?:-[^\\s]+\\s+)*${escaped}\\b(?!\\s*=)`),
    ]
    if (bareTargetPatterns.some((pattern) => pattern.test(maskedCode))) delete varMap[varName]
  }

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename $vars in text
  const renameVarsInText = (text) => {
    let result = text
    for (const varName of sortedVars) {
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const braceRegex = new RegExp('\\$\\{([!#]?)' + escaped + '(?=\\}|\\[|[:#%/\\^,=+?@*\\-])', 'g')
      const useRegex = new RegExp('\\$' + varName + '\\b', 'g')
      result = result.replace(braceRegex, (_match, modifier) => '${' + modifier + varMap[varName])
      result = result.replace(useRegex, '$' + varMap[varName])
    }
    return result
  }

  const renameArithmeticNames = (expression) => {
    let result = expression
    for (const varName of sortedVars) {
      const regex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      result = result.replace(regex, varMap[varName])
    }
    return result
  }

  // Helper: rename in code (includes assignments + commands)
  const renameInCode = (codeSegment) => {
    let result = codeSegment
    for (const varName of sortedVars) {
      // Bash arrays can be assigned through indexed targets such as
      // values[$key]=... and values[$key]+=.... Rename the bare target as well
      // as $values/${values[...]}/arithmetic references.
      const assignRegex = new RegExp('\\b' + varName + '(\\[[^\\]\\r\\n]*\\])?(\\s*)([+\\-*/%&|^]?=)', 'g')
      result = result.replace(assignRegex, varMap[varName] + '$1$2$3')
    }
    result = renameVarsInText(result)
    result = transformArithmeticRegions(result, renameArithmeticNames)
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
      const newValue = transformArithmeticRegions(renameVarsInText(token.value), renameArithmeticNames)
      return { ...token, value: newValue, raw: `"${newValue}"` }
    }
    if (token.type === 'string' && token.quoteChar === 'heredoc' && token.prefix === 'unquoted') {
      const newValue = transformArithmeticRegions(renameVarsInText(token.value), renameArithmeticNames)
      return { ...token, value: newValue, raw: newValue }
    }
    return token
  })

  return tokensToCode(transformed)
}

/* ── Encode a single static text segment for Bash ────────── */

function encodeStaticBash(rawText) {
  if (!rawText) return ''
  const text = rawText
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
    if (quoteChar === 'heredoc') return content
    if (quoteChar === "$'") return `$'${content}'`
    if (quoteChar === "'") return `'${content}'`
    if (content.includes('\\') || content.endsWith('\n')) return `"${content}"`

    // Interpolation-aware: split into static + variable segments
    if (hasInterpolation(content, 'bash')) {
      const segments = splitInterpolatedString(content, 'bash')
      // Build: "encoded_static$var encoded_static2"
      const parts = segments.map(seg => {
        if (seg.type === 'var') return seg.value // Leave $var, $(cmd) intact
        if (seg.value.length === 0) return ''
        return encodeStaticBash(seg.value)
      }).filter(p => p.length > 0)
      return `"${parts.join('')}"`
    }

    // No interpolation — encode entire string
    return `"${encodeStaticBash(content)}"`
  })

  return tokensToCode(transformed)
}

/* ── XOR String Encryption (interpolation-aware) ─────────── */

function applyXorStringEncryption(code) {
  const funcName = '_xd_' + randomVarName('short').toLowerCase()
  let helperInjected = false
  const tokens = tokenize(code, 'bash')

  const transformed = transformStrings(tokens, (content, quoteChar) => {
    if (quoteChar === 'heredoc') return content
    if (quoteChar === "$'" || quoteChar === "'") {
      return quoteChar === "'" ? `'${content}'` : `$'${content}'`
    }
    if (content.includes('\\') || content.endsWith('\n')) return `"${content}"`
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
      return `"${parts.join('')}"`
    }

    const xor = xorEncryptForLanguage(content, 'bash', funcName)
    if (!helperInjected) helperInjected = true
    return `"${xor.inline}"`
  })

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'bash', funcName).helper
    result = insertBashPreamble(result, helper)
  }
  return result
}

/* ── Dead Code Injection ─────────────────────────────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const maskedLines = maskBashNonCode(code).split('\n')
  const result = []
  let openParens = 0
  let caseDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const maskedLine = maskedLines[i] || ''
    const trimmed = maskedLine.trim()
    result.push(line)

    if (/^case\b.*\bin\s*$/.test(trimmed)) caseDepth++
    if (/^esac\b/.test(trimmed)) caseDepth = Math.max(0, caseDepth - 1)
    for (const ch of maskedLine) {
      if (ch === '(' || ch === '[') openParens++
      else if (ch === ')' || ch === ']') openParens = Math.max(0, openParens - 1)
    }

    const nextTrimmed = (maskedLines[i + 1] || '').trim()
    const structural = /^(?:if|then|elif|else|fi|for|while|until|select|do|done|case|esac|function)\b/.test(trimmed) ||
      /^(?:then|do|else|elif|fi|done|esac|\|\||&&|\|)/.test(nextTrimmed) ||
      /(?:\\|\||\|\||&&)$/.test(trimmed) || trimmed.endsWith('{') || trimmed === '}'

    if (openParens > 0 || caseDepth > 0 || structural || !trimmed) continue
    if (i > 0 && i % (2 + Math.floor(Math.random() * 3)) === 0) {
      if (isSafeForInjection(maskedLine, 'bash')) {
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

  const preamble = `# Environment validation
${v1}=$(nproc 2>/dev/null || echo 1)
[ "$${v1}" -lt 2 ] && exit 0
sleep ${sleepSec}
if [ -f /proc/self/status ]; then
  grep -qi "TracerPid:[[:space:]]*[1-9]" /proc/self/status && exit 0
fi
`
  return insertBashPreamble(code, preamble)
}

/* ── Polymorphic Encryption Wrapper (v4.5) ───────────────── */

function bashJunk() {
  const pool = [
    () => { const v = randomVarName('short').toLowerCase(); return `${v}=$(( ${Math.floor(Math.random()*999)} * ${Math.floor(Math.random()*99)} + ${Math.floor(Math.random()*9999)} ))` },
    () => { const v = randomVarName('short').toLowerCase(); return `${v}=$(printf '%d' $((RANDOM % 256)))` },
    () => `: $((${Math.floor(Math.random()*0xFFFF)} ^ ${Math.floor(Math.random()*0xFFFF)}))`,
    () => { const v = randomVarName('short').toLowerCase(); return `${v}="${Array.from({length: 8}, () => String.fromCharCode(97 + Math.floor(Math.random()*26))).join('')}"` },
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function bashLoopJunk(iv) {
  const pool = [
    () => `    : $(( ${iv} * ${3 + Math.floor(Math.random()*17)} + ${Math.floor(Math.random()*255)} ))`,
    () => `    : $(( ${iv} ^ ${Math.floor(Math.random()*0xFF)} ))`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function shufArr(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Stealth Execution (v4.7) ────────────────────────────── */

function stealthEval(funcCallExpr) {
  // funcCallExpr is the function call that returns the decoded string,
  // e.g. the function name like: echo "$(func)" | base64 -d
  // We always use eval with double quotes to ensure command substitution works
  // and the function remains in scope (no subshell/pipe issues).
  const rv = randomVarName('short').toLowerCase()
  const methods = [
    // eval with command substitution (direct)
    () => `eval "$(${funcCallExpr})"`,
    // assign to variable, then eval (adds indirection)
    () => `${rv}=$(${funcCallExpr})\neval "$${rv}"`,
  ]
  return methods[Math.floor(Math.random() * methods.length)]()
}

function applyEncryptionWrapper(code) {
  const method = Math.floor(Math.random() * 3)
  switch (method) {
    case 0: return bashWrapperXorB64(code)
    case 1: return bashWrapperHexShift(code)
    case 2: return bashWrapperByteRot(code)
    default: return bashWrapperXorB64(code)
  }
}

/* Method 1: XOR + Base64 (polymorphic) */
function bashWrapperXorB64(code) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorData = Array.from(b64).map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  const dv = randomVarName('short').toLowerCase()
  const kv = randomVarName('short').toLowerCase()
  const fv = randomVarName('short').toLowerCase()
  const iv = randomVarName('short').toLowerCase()

  const inits = shufArr([
    `${dv}=(${xorData.join(' ')})`,
    `${kv}=(${key.join(' ')})`,
    bashJunk(),
    bashJunk(),
  ])

  return `#!/bin/bash
${inits.join('\n')}

${fv}() {
    local _r=""
    local _kl=\${#${kv}[@]}
    for ${iv} in $(seq 0 $((\${#${dv}[@]} - 1))); do
${bashLoopJunk(iv)}
        local _b=$((\${${dv}[$${iv}]} ^ \${${kv}[$(($${iv} % $_kl))]}))
        _r="$_r$(printf "\\\\$(printf '%03o' $_b)")"
    done
    echo "$_r"
}

${stealthEval(`echo "$(${fv})" | base64 -d`)}
`
}

/* Method 2: Hex-Shift (B64-first for Unicode safety) */
function bashWrapperHexShift(code) {
  const shift = 3 + Math.floor(Math.random() * 25)
  // B64-first: encode to Base64 (ASCII-safe) THEN hex-shift
  const b64 = toBase64(code)
  const hexStr = Array.from(b64).map(c => ((c.charCodeAt(0) + shift) % 256).toString(16).padStart(2, '0')).join('')

  const dv = randomVarName('short').toLowerCase()
  const sv = randomVarName('short').toLowerCase()
  const fv = randomVarName('short').toLowerCase()

  const inits = shufArr([
    `${dv}="${hexStr}"`,
    `${sv}=${shift}`,
    bashJunk(),
  ])

  return `#!/bin/bash
${inits.join('\n')}

${fv}() {
    local _r=""
    local _len=\${#${dv}}
    for (( _i=0; _i<_len; _i+=2 )); do
        local _hex=\${${dv}:_i:2}
        local _dec=$((16#$_hex))
        local _b=$(((_dec - ${sv} + 256) % 256))
        _r="$_r$(printf "\\\\$(printf '%03o' $_b)")"
    done
    echo "$_r"
}

${stealthEval(`echo "$(${fv})" | base64 -d`)}
`
}

/* Method 3: Byte Rotation + B64 */
function bashWrapperByteRot(code) {
  const rotN = 3 + Math.floor(Math.random() * 50)
  const b64 = toBase64(code)
  const rotated = Array.from(b64).map(c => (c.charCodeAt(0) + rotN) % 256)

  const dv = randomVarName('short').toLowerCase()
  const nv = randomVarName('short').toLowerCase()
  const fv = randomVarName('short').toLowerCase()

  const inits = shufArr([
    `${dv}=(${rotated.join(' ')})`,
    `${nv}=${rotN}`,
    bashJunk(),
    bashJunk(),
  ])

  return `#!/bin/bash
${inits.join('\n')}

${fv}() {
    local _r=""
    for _i in $(seq 0 $((\${#${dv}[@]} - 1))); do
        local _b=$(((\${${dv}[$_i]} - ${nv} + 256) % 256))
        _r="$_r$(printf "\\\\$(printf '%03o' $_b)")"
    done
    echo "$_r"
}

${stealthEval(`echo "$(${fv})" | base64 -d`)}
`
}
