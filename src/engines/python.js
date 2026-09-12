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

import { toBase64, xorEncryptForLanguage } from '../utils/encoding.js'
import { randomVarName, generateDeadCode, randomXorKey } from '../utils/randomization.js'
import { tokenize, hasUnicode, hasInterpolation, splitInterpolatedString, isSafeForInjection } from '../utils/parser.js'

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

function tokenRaw(token) {
  if (token.type !== 'string') return token.value
  return token.raw || `${token.prefix || ''}${token.quoteChar}${token.value}${token.quoteChar}`
}

function maskPythonNonCode(code) {
  return tokenize(code, 'python').map((token) => {
    if (token.type === 'code') return token.value
    return tokenRaw(token).replace(/[^\r\n]/g, ' ')
  }).join('')
}

function mapPythonFStringExpressions(content, transform) {
  let output = ''
  let found = false

  for (let i = 0; i < content.length;) {
    if (content[i] === '{' && content[i + 1] === '{') {
      output += '{{'
      i += 2
      continue
    }
    if (content[i] === '}' && content[i + 1] === '}') {
      output += '}}'
      i += 2
      continue
    }
    if (content[i] !== '{') {
      output += content[i++]
      continue
    }

    let depth = 1
    let quote = ''
    let escaped = false
    let j = i + 1
    for (; j < content.length; j++) {
      const ch = content[j]
      if (quote) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === quote) quote = ''
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) break
    }

    if (depth !== 0) {
      output += content.slice(i)
      break
    }

    found = true
    output += `{${transform(content.slice(i + 1, j))}}`
    i = j + 1
  }

  return { content: output, found }
}

function hasTopLevelFStringFormatting(expression) {
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i]
    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth = Math.max(0, depth - 1); continue }
    if (depth === 0 && (ch === ':' || ch === '!')) return true
    if (depth === 0 && ch === '=') {
      const prev = expression[i - 1] || ''
      const next = expression[i + 1] || ''
      if (!'=!<>:'.includes(prev) && next !== '=') return true
    }
  }
  return false
}

function isComplexPythonFString(content) {
  let complex = false
  const mapped = mapPythonFStringExpressions(content, (expression) => {
    if (hasTopLevelFStringFormatting(expression)) complex = true
    return expression
  })
  return !mapped.found || complex
}

function isPythonPatternLiteral(tokens, index) {
  const before = tokens.slice(0, index).map(tokenRaw).join('')
  const currentLine = before.slice(Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r')) + 1)
  return /^\s*case\b/.test(currentLine)
}

function isPotentialPythonDocstring(tokens, index) {
  const before = tokens.slice(0, index).map(tokenRaw).join('')
  const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r')) + 1
  if (before.slice(lineStart).trim() !== '') return false

  const priorLines = before.slice(0, lineStart).split(/\r?\n/)
  while (priorLines.length > 0) {
    const line = priorLines.pop().trim()
    if (!line || line.startsWith('#')) continue
    return line.endsWith(':')
  }
  return true
}

function insertPythonPreamble(code, preamble) {
  const lines = code.split(/(?<=\n)/)
  let index = 0

  if (lines[index]?.startsWith('#!')) index++
  for (let i = 0; i < Math.min(2, lines.length); i++) {
    if (/coding[:=]\s*[-\w.]+/.test(lines[i]) && index <= i) index = i + 1
  }

  while (index < lines.length && /^\s*(?:#.*)?(?:\r?\n)?$/.test(lines[index])) index++

  const remaining = lines.slice(index).join('')
  const docMatch = /^(\s*)(?:[rRuU]?)("""|'''|"|')/.exec(remaining)
  if (docMatch) {
    const quote = docMatch[2]
    const openAt = docMatch.index + docMatch[0].length - quote.length
    let closeAt
    if (quote.length === 3) {
      closeAt = remaining.indexOf(quote, openAt + 3)
    } else {
      closeAt = openAt + 1
      while (closeAt < remaining.length) {
        if (remaining[closeAt] === '\\') closeAt += 2
        else if (remaining[closeAt] === quote) break
        else closeAt++
      }
    }
    if (closeAt !== -1) {
      const consumed = remaining.slice(0, closeAt + quote.length)
      index += (consumed.match(/\n/g) || []).length
      if (lines[index] && !lines[index].endsWith('\n')) index++
      else if (lines[index]) index++
    }
  }

  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (!trimmed || trimmed.startsWith('#')) { index++; continue }
    if (!/^from\s+__future__\s+import\b/.test(trimmed)) break
    let balance = 0
    do {
      const line = lines[index++] || ''
      for (const ch of line) {
        if (ch === '(') balance++
        else if (ch === ')') balance--
      }
    } while (index < lines.length && (balance > 0 || lines[index - 1].trimEnd().endsWith('\\')))
  }

  lines.splice(index, 0, preamble.endsWith('\n') ? preamble : preamble + '\n')
  return lines.join('')
}

/* ── Variable Randomization (context-aware) ──────────────── */

function applyVariableRandomization(code) {
  const reserved = new Set([
    // Keywords & builtins
    'import', 'from', 'as', 'def', 'class', 'return', 'if', 'else', 'elif',
    'while', 'for', 'in', 'try', 'except', 'finally', 'with', 'pass', 'break',
    'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'lambda',
    'self', 'print', 'range', 'len', 'str', 'int', 'float', 'list', 'dict',
    'tuple', 'set', 'type', 'os', 'sys', 'socket', 'subprocess', '__name__',
    '__import__', '__builtins__', 'exec', 'eval', 'open', 'input', 'super',
    'yield', 'del', 'global', 'nonlocal', 'assert', 'raise', 'async', 'await',
    'bytes', 'map', 'filter', 'zip', 'enumerate', 'sorted', 'reversed',
    'base64', 'time', 'struct', 'ctypes', 'threading', 'multiprocessing',
    // Library methods (dot-notation targets)
    'connect', 'send', 'recv', 'write', 'read', 'close', 'append', 'extend',
    'join', 'split', 'strip', 'replace', 'encode', 'decode', 'format',
    'lower', 'upper', 'startswith', 'endswith', 'sleep', 'sqrt', 'exit',
    'wait', 'communicate', 'popen', 'call', 'check_output', 'getaddrinfo',
    'bind', 'listen', 'accept', 'makefile', 'fileno', 'settimeout',
    'setsockopt', 'gethostname', 'gethostbyname', 'keys', 'values', 'items',
    'pop', 'get', 'update', 'copy', 'clear', 'remove', 'insert', 'index',
    'count', 'sort', 'reverse', 'seek', 'tell', 'flush', 'readline',
    'readlines', 'writelines', 'getattr', 'setattr', 'hasattr', 'isinstance',
    'issubclass', 'compile', 'chr', 'ord', 'hex', 'bin', 'oct', 'abs',
    'round', 'min', 'max', 'sum', 'any', 'all', 'next', 'iter', 'hash',
    'id', 'dir', 'vars', 'locals', 'globals', 'property', 'staticmethod',
    'classmethod', 'object', 'Exception', 'ValueError', 'TypeError',
    'KeyError', 'IndexError', 'AttributeError', 'IOError', 'OSError',
  ])

  function isRenamable(name) {
    return !reserved.has(name) && name.length > 1 &&
           !name.startsWith('__') && !/^[A-Z_]+$/.test(name)
  }

  // ── Phase 1: Collect assignment targets from masked Python code ──
  const tokens = tokenize(code, 'python')
  const varMap = {}

  const addVariable = (name) => {
    if (isRenamable(name) && !varMap[name]) varMap[name] = randomVarName('snake_case')
  }
  const collectTargets = (target) => {
    const withoutAnnotation = target.replace(/:\s*[^,]+$/g, '')
    const unwrapped = withoutAnnotation.replace(/[()[\]]/g, ' ')
    if (!/^\s*[a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*\s*$/.test(unwrapped)) return
    for (const name of unwrapped.split(',').map((part) => part.trim())) addVariable(name)
  }

  const maskedCode = maskPythonNonCode(code)

  // Runtime name lookup cannot be updated safely without a Python AST and scope
  // analysis. Prefer a safe no-op to silently changing reflected identifiers.
  if (/\b(?:globals|locals|vars|exec|eval|compile)\s*\(/.test(maskedCode)) return code

  for (const line of maskedCode.split(/\r?\n/)) {
    for (const statement of line.split(';')) {
      const assignment = /^\s*(.+?)\s*(?:\+|-|\*|\/|\/\/|%|&|\||\^|>>|<<|@)?=(?!=)/.exec(statement)
      if (assignment) collectTargets(assignment[1])
    }
  }

  let match
  const walrusPattern = /\b([a-zA-Z_]\w*)\s*:=/g
  while ((match = walrusPattern.exec(maskedCode)) !== null) addVariable(match[1])

  const asPattern = /\bas\s+([a-zA-Z_]\w*)\b/g
  while ((match = asPattern.exec(maskedCode)) !== null) addVariable(match[1])

  const forPattern = /\bfor\s+(.+?)\s+in\b/g
  while ((match = forPattern.exec(maskedCode)) !== null) {
    const target = match[1].split(/\r?\n/).pop()
    collectTargets(target)
  }

  // Names used as parameters, imported symbols, or attributes are API-facing.
  // A global regex rename cannot safely distinguish their individual scopes.
  const protectedNames = new Set()
  const parameterPattern = /\b(?:async\s+)?def\s+[a-zA-Z_]\w*\s*\(([^)]*)\)/g
  while ((match = parameterPattern.exec(maskedCode)) !== null) {
    for (const parameter of match[1].split(',')) {
      const name = parameter.trim().replace(/^\*{0,2}/, '').match(/^[a-zA-Z_]\w*/)?.[0]
      if (name) protectedNames.add(name)
    }
  }
  const attributePattern = /\.\s*([a-zA-Z_]\w*)\b/g
  while ((match = attributePattern.exec(maskedCode)) !== null) protectedNames.add(match[1])

  // Protect keyword/default labels inside parentheses even when a call spans
  // several lines or string tokens. Per-token replacement does not retain the
  // opening parenthesis, so this must be collected from the complete mask.
  let parenDepth = 0
  for (let i = 0; i < maskedCode.length;) {
    const ch = maskedCode[i]
    if (ch === '(') { parenDepth++; i++; continue }
    if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); i++; continue }
    if (parenDepth > 0 && /[a-zA-Z_]/.test(ch)) {
      let end = i + 1
      while (end < maskedCode.length && /[a-zA-Z0-9_]/.test(maskedCode[end])) end++
      let after = end
      while (after < maskedCode.length && /\s/.test(maskedCode[after])) after++
      if (maskedCode[after] === '=' && maskedCode[after + 1] !== '=') {
        protectedNames.add(maskedCode.slice(i, end))
      }
      i = end
      continue
    }
    i++
  }

  const fromImportPattern = /^\s*from\s+[^\r\n]+?\s+import\s+([^\r\n]+)/gm
  while ((match = fromImportPattern.exec(maskedCode)) !== null) {
    for (const imported of match[1].split(',')) {
      const names = imported.trim().match(/^([a-zA-Z_]\w*)(?:\s+as\s+([a-zA-Z_]\w*))?$/)
      if (names) protectedNames.add(names[2] || names[1])
    }
  }
  for (const name of protectedNames) delete varMap[name]

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename vars in a text segment
  function renameVarsIn(text) {
    let result = text
    for (const varName of sortedVars) {
      const regex = new RegExp('(?<!\\.)\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      result = result.replace(regex, (matched, offset, source) => {
        const after = source.slice(offset + matched.length)
        if (/^\s*=(?!=)/.test(after)) {
          const lineStart = Math.max(source.lastIndexOf('\n', offset), source.lastIndexOf('\r', offset)) + 1
          const before = source.slice(lineStart, offset)
          let parenDepth = 0
          for (const ch of before) {
            if (ch === '(') parenDepth++
            else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
          }
          if (parenDepth > 0) return matched
        }
        return varMap[varName]
      })
    }
    return result
  }

  // ── Phase 2: Replace in CODE tokens + F-STRING tokens ──
  const result = tokens.map((token) => {
    if (token.type === 'code') {
      return { ...token, value: renameVarsIn(token.value) }
    }

    // F-STRING: rename only identifiers inside interpolation expressions.
    // Static text and quoted dictionary keys must remain untouched.
    if (token.type === 'string' && (token.prefix || '').toLowerCase().includes('f')) {
      const newContent = mapPythonFStringExpressions(token.value, (expression) => {
        return tokenize(expression, 'python').map((part) => {
          return part.type === 'code' ? renameVarsIn(part.value) : tokenRaw(part)
        }).join('')
      }).content
      const newRaw = (token.prefix || '') + token.quoteChar + newContent + token.quoteChar
      return { ...token, value: newContent, raw: newRaw }
    }

    return token
  })

  // Reconstruct code from tokens
  return result.map((t) => {
    return tokenRaw(t)
  }).join('')
}

/* ── Encode a single static Python text segment ──────────── */

function encodePyStatic(text) {
  if (!text || text.length === 0) return '""'
  if (hasUnicode(text)) {
    const b64 = toBase64(text)
    return `getattr(__import__("base64"), "b64decode")("${b64}").decode("utf-8")`
  }
  const method = Math.floor(Math.random() * 3)
  switch (method) {
    case 0: {
      const hex = Array.from(text)
        .map((c) => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
      return `b"${hex}".decode()`
    }
    case 1: {
      const hexStr = Array.from(text)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
      return `bytes.fromhex("${hexStr}").decode()`
    }
    case 2: {
      const b64 = toBase64(text)
      return `getattr(__import__("base64"), "b64decode")("${b64}").decode()`
    }
    default:
      return `"${text}"`
  }
}

/* ── String Encoding (context-aware, f-string aware) ─────── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'python')

  // Mark transformed strings so we can fix implicit concatenation
  const transformed = tokens.map((token, index) => {
    if (token.type !== 'string') return token
    if (token.value.length < 2) return token

    const content = token.value
    const quoteChar = token.quoteChar
    const prefix = token.prefix || ''

    // Skip triple-quoted strings — never obfuscate
    if (quoteChar === '"""' || quoteChar === "'''") {
      return token // keep as-is
    }

    // Preserve literals whose exact syntactic form carries meaning.
    if (content.includes('\\') || isPythonPatternLiteral(tokens, index) || isPotentialPythonDocstring(tokens, index)) {
      return token
    }

    // b-strings: keep as bytes literal (don't encode)
    const lowerPrefix = prefix.toLowerCase()
    if (lowerPrefix === 'b' || lowerPrefix === 'br' || lowerPrefix === 'rb') {
      return token // keep as-is
    }

    let encoded
    // F-STRINGS: Deconstruct into concatenation (encode static, keep vars)
    const isFString = lowerPrefix.includes('f')
    if (isFString && isComplexPythonFString(content)) return token
    if (isFString && hasInterpolation(content, 'python')) {
      const segments = splitInterpolatedString(content, 'python')
      const parts = segments.map(seg => {
        if (seg.type === 'var') return `str(${seg.value})`
        if (seg.value.length === 0) return ''
        return encodePyStatic(seg.value)
      }).filter(p => p.length > 0)
      encoded = parts.length === 1 ? parts[0] : `(${parts.join(' + ')})`
    } else if (hasUnicode(content)) {
      const b64 = toBase64(content)
      encoded = `getattr(__import__("base64"), "b64decode")("${b64}").decode("utf-8")`
    } else {
      encoded = encodePyStatic(content)
    }

    // Tag as transformed-from-string so we can fix implicit concat
    return { type: 'code', value: encoded, _wasString: true }
  })

  // Fix Python implicit string concatenation:
  // If two adjacent transformed tokens exist (with only whitespace between),
  // insert ' + ' to prevent (expr)(expr) being interpreted as a function call
  const result = []
  for (let i = 0; i < transformed.length; i++) {
    result.push(transformed[i])

    if (transformed[i]._wasString) {
      // Look ahead: skip whitespace-only code tokens, find next _wasString
      let j = i + 1
      while (j < transformed.length) {
        if (transformed[j].type === 'code' && /^\s+$/.test(transformed[j].value)) {
          j++
          continue
        }
        break
      }
      if (j < transformed.length && transformed[j]._wasString) {
        // Replace the whitespace between with ' + '
        // Remove intermediate whitespace tokens and add connector
        const wsTokens = []
        for (let k = i + 1; k < j; k++) wsTokens.push(k)
        // Mark them to be replaced with ' + '
        for (const k of wsTokens) {
          transformed[k] = { type: 'code', value: '' } // clear whitespace
        }
        // Add ' + ' after current token
        result.push({ type: 'code', value: ' + ' })
      }
    }
  }

  return result.map((t) => {
    if (t.type === 'string') return t.raw || `${t.prefix || ''}${t.quoteChar}${t.value}${t.quoteChar}`
    return t.value
  }).join('')
}

/* ── XOR String Encryption (Platinum) ────────────────────── */

function applyXorStringEncryption(code) {
  const funcName = '_' + randomVarName('snake_case')
  let helperInjected = false
  const tokens = tokenize(code, 'python')

  // Manual token processing (same pattern as applyStringEncoding)
  // to handle implicit string concatenation with + insertion
  const transformed = tokens.map((token, index) => {
    if (token.type !== 'string') return token
    if (token.value.length < 2) return token

    const content = token.value
    const quoteChar = token.quoteChar
    const prefix = token.prefix || ''

    if (quoteChar === '"""' || quoteChar === "'''") return token
    if (content.includes('\\') || isPythonPatternLiteral(tokens, index) || isPotentialPythonDocstring(tokens, index)) return token
    const lp = prefix.toLowerCase()
    if (lp === 'b' || lp === 'br' || lp === 'rb') return token
    if (content.length < 3) return token // keep short strings as-is

    let encoded
    const isFString = lp.includes('f')
    if (isFString && isComplexPythonFString(content)) return token
    if (isFString && hasInterpolation(content, 'python')) {
      const segments = splitInterpolatedString(content, 'python')
      const parts = segments.map(seg => {
        if (seg.type === 'var') return `str(${seg.value})`
        if (seg.value.length < 3) return seg.value.length > 0 ? `"${seg.value}"` : ''
        const xor = xorEncryptForLanguage(seg.value, 'python', funcName)
        if (!helperInjected) helperInjected = true
        return xor.inline
      }).filter(p => p.length > 0)
      encoded = parts.length === 1 ? parts[0] : `(${parts.join(' + ')})`
    } else {
      const xor = xorEncryptForLanguage(content, 'python', funcName)
      if (!helperInjected) helperInjected = true
      encoded = xor.inline
    }

    return { type: 'code', value: encoded, _wasString: true }
  })

  // Fix implicit string concatenation: insert + between adjacent transformed tokens
  const result = []
  for (let i = 0; i < transformed.length; i++) {
    result.push(transformed[i])
    if (transformed[i]._wasString) {
      let j = i + 1
      while (j < transformed.length) {
        if (transformed[j].type === 'code' && /^\s+$/.test(transformed[j].value)) { j++; continue }
        break
      }
      if (j < transformed.length && transformed[j]._wasString) {
        for (let k = i + 1; k < j; k++) transformed[k] = { type: 'code', value: '' }
        result.push({ type: 'code', value: ' + ' })
      }
    }
  }

  let output = result.map((t) => {
    if (t.type === 'string') return t.raw || `${t.prefix || ''}${t.quoteChar}${t.value}${t.quoteChar}`
    return t.value
  }).join('')

  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'python', funcName).helper
    output = insertPythonPreamble(output, helper + '\n')
  }
  return output
}

/* ── Dead Code Injection (safe locations only) ───────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const maskedLines = maskPythonNonCode(code).split('\n')
  const result = []

  // Track open parens/brackets/braces for multi-line expression detection
  let openParens = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const maskedLine = maskedLines[i] || ''
    const trimmed = maskedLine.trim()
    result.push(line)

    // Count open/close brackets to detect multi-line expressions
    for (const ch of maskedLine) {
      if (ch === '(' || ch === '[' || ch === '{') openParens++
      if (ch === ')' || ch === ']' || ch === '}') openParens = Math.max(0, openParens - 1)
    }

    // Skip injection if:
    // 1. Inside a multi-line expression (open parens/brackets)
    // 2. Line ends with ':' (def/for/if/while/class/try/except/with block opener)
    // 3. Line ends with '\' (explicit line continuation)
    // 4. Line is empty or just a comment
    // 5. Line is a decorator (@)
    if (openParens > 0) continue
    if (trimmed.endsWith(':')) continue
    if (trimmed.endsWith('\\')) continue
    if (trimmed === '' || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('@')) continue

    if (i > 0 && i % (3 + Math.floor(Math.random() * 3)) === 0) {
      if (isSafeForInjection(maskedLine, 'python')) {
        // Match indentation of current line
        const indent = line.match(/^(\s*)/)?.[1] || ''
        const injected = generateDeadCode('python')
          .split('\n')
          .map((injectedLine) => indent + injectedLine)
          .join('\n')
        result.push(injected)
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

  const preamble = `import time as ${v1}
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
`
  return insertPythonPreamble(code, preamble)
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
    // types.FunctionType (must pass globals() for builtins/imports)
    () => `(lambda c: __import__('types').FunctionType(compile(c, '', 'exec'), globals())())(${payloadExpr})`,
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
  // Transform Base64 ASCII rather than JavaScript UTF-16 code units.
  // This preserves non-BMP Unicode such as emoji on every wrapper variant.
  const b64 = toBase64(code)
  const hexStr = Array.from(b64).map(c => ((c.charCodeAt(0) + shift) % 256).toString(16).padStart(2, '0')).join('')

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

  return [...initParts, '', funcBody, '', stealthExec(`getattr(__import__("base64"), "b64decode")(${fv}(${dv}, ${sv})).decode("utf-8")`)].join('\n') + '\n'
}

/* Method 3: Multi-XOR (2-key chain) */
function pyWrapperMultiXor(code) {
  const key1 = randomXorKey(16)
  const key2 = randomXorKey(16)
  const b64 = toBase64(code)
  const encoded = Array.from(b64).map((c, i) => (c.charCodeAt(0) ^ key1[i % key1.length]) ^ key2[i % key2.length])

  const dv = randomVarName('snake_case')
  const k1v = randomVarName('snake_case')
  const k2v = randomVarName('snake_case')
  const fv = randomVarName('snake_case')
  const iv = randomVarName('snake_case')

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

  return [...initParts, '', fixedFunc, '', stealthExec(`getattr(__import__("base64"), "b64decode")(${fv}(${dv}, ${k1v}, ${k2v})).decode("utf-8")`)].join('\n') + '\n'
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
