/**
 * Context-Aware Code Parser
 * Tokenizes source code into segments: strings, comments, and code.
 * Engines use this to ONLY modify safe regions (string literals),
 * never touching syntax, keywords, or structural delimiters.
 */

/**
 * Token types
 * @typedef {'string' | 'comment' | 'code'} TokenType
 * @typedef {{ type: TokenType, value: string, quoteChar?: string }} Token
 */

/**
 * Extract all string literals from code, returning tokens with positions.
 * This allows engines to selectively encode only string content.
 *
 * @param {string} code - Source code
 * @param {string} language - 'powershell' | 'python' | 'bash' | 'csharp' | 'go'
 * @returns {Token[]} Array of tokens
 */
export function tokenize(code, language) {
  const tokens = []
  let i = 0

  while (i < code.length) {
    let consumed = false

    // --- Comments ---
    const commentResult = tryComment(code, i, language)
    if (commentResult) {
      tokens.push({ type: 'comment', value: commentResult.value })
      i = commentResult.end
      consumed = true
    }

    if (!consumed) {
      // --- String literals ---
      const stringResult = tryString(code, i, language)
      if (stringResult) {
        tokens.push({
          type: 'string',
          value: stringResult.value,
          quoteChar: stringResult.quoteChar,
          prefix: stringResult.prefix || '',
          raw: stringResult.raw,
        })
        i = stringResult.end
        consumed = true
      }
    }

    if (!consumed) {
      // --- Code (non-string, non-comment) ---
      // Accumulate code characters until we hit a string or comment start
      let codeStart = i
      while (i < code.length) {
        if (tryComment(code, i, language) || tryString(code, i, language)) break
        i++
      }
      if (i > codeStart) {
        tokens.push({ type: 'code', value: code.substring(codeStart, i) })
      }
    }
  }

  return tokens
}

/**
 * Reconstruct code from tokens
 * @param {Token[]} tokens
 * @returns {string}
 */
export function tokensToCode(tokens) {
  return tokens.map((t) => {
    if (t.type === 'string') return t.raw || `${t.quoteChar}${t.value}${t.quoteChar}`
    return t.value
  }).join('')
}

/**
 * Apply a transform function ONLY to string literal tokens
 * @param {Token[]} tokens
 * @param {function(string, string): string} transformFn - (content, quoteChar) => newRawString
 * @returns {Token[]}
 */
export function transformStrings(tokens, transformFn) {
  return tokens.map((token) => {
    if (token.type !== 'string') return token
    if (token.value.length < 2) return token // Skip very short strings
    const transformed = transformFn(token.value, token.quoteChar, token.prefix || '')
    return { type: 'code', value: transformed } // Becomes raw code (no quotes needed)
  })
}

/**
 * Extract only code segments (for variable renaming etc.)
 * Ensures we never rename inside strings or comments
 * @param {string} code
 * @param {string} language
 * @param {function(string): string} transformFn
 * @returns {string}
 */
export function transformCodeOnly(code, language, transformFn) {
  const tokens = tokenize(code, language)
  return tokens.map((token) => {
    if (token.type === 'code') {
      return { ...token, value: transformFn(token.value) }
    }
    return token
  }).map((t) => {
    if (t.type === 'string') return t.raw || `${t.quoteChar}${t.value}${t.quoteChar}`
    return t.value
  }).join('')
}

// ─── Internal: Try to match a comment at position i ────────────────

function tryComment(code, i, language) {
  switch (language) {
    case 'powershell': {
      // Single-line: #
      if (code[i] === '#' && (i === 0 || code[i - 1] !== '`')) {
        const end = code.indexOf('\n', i)
        const realEnd = end === -1 ? code.length : end + 1
        return { value: code.substring(i, realEnd), end: realEnd }
      }
      // Block comment: <# ... #>
      if (code[i] === '<' && code[i + 1] === '#') {
        const end = code.indexOf('#>', i + 2)
        const realEnd = end === -1 ? code.length : end + 2
        return { value: code.substring(i, realEnd), end: realEnd }
      }
      break
    }
    case 'python': {
      if (code[i] === '#') {
        const end = code.indexOf('\n', i)
        const realEnd = end === -1 ? code.length : end + 1
        return { value: code.substring(i, realEnd), end: realEnd }
      }
      break
    }
    case 'bash': {
      if (code[i] === '#' && (i === 0 || code[i - 1] !== '$')) {
        // Don't treat ${# as comment
        if (i > 0 && code[i - 1] === '{') break
        const end = code.indexOf('\n', i)
        const realEnd = end === -1 ? code.length : end + 1
        return { value: code.substring(i, realEnd), end: realEnd }
      }
      break
    }
    case 'csharp':
    case 'go': {
      // Single-line: //
      if (code[i] === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i)
        const realEnd = end === -1 ? code.length : end + 1
        return { value: code.substring(i, realEnd), end: realEnd }
      }
      // Block: /* ... */
      if (code[i] === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2)
        const realEnd = end === -1 ? code.length : end + 2
        return { value: code.substring(i, realEnd), end: realEnd }
      }
      break
    }
  }
  return null
}

// ─── Internal: Try to match a string literal at position i ─────────

function tryString(code, i, language) {
  const ch = code[i]

  // Python: detect string prefixes (f, r, b, u, fr, rf, br, rb)
  if (language === 'python') {
    let prefix = ''
    let si = i // string start index (after prefix)
    const prefixPatterns = ['fr', 'rf', 'br', 'rb', 'f', 'r', 'b', 'u', 'FR', 'RF', 'BR', 'RB', 'F', 'R', 'B', 'U']
    for (const p of prefixPatterns) {
      if (code.substring(i, i + p.length).toLowerCase() === p.toLowerCase() &&
          (code[i + p.length] === '"' || code[i + p.length] === "'")) {
        prefix = code.substring(i, i + p.length)
        si = i + p.length
        break
      }
    }

    const sch = code[si]

    // Triple-quoted strings (must check before single quotes)
    if ((sch === '"' && code[si + 1] === '"' && code[si + 2] === '"') ||
        (sch === "'" && code[si + 1] === "'" && code[si + 2] === "'")) {
      const closer = sch.repeat(3)
      const end = code.indexOf(closer, si + 3)
      const realEnd = end === -1 ? code.length : end + 3
      const content = code.substring(si + 3, end === -1 ? code.length : end)
      return {
        value: content,
        quoteChar: closer,
        prefix: prefix,
        raw: code.substring(i, realEnd),
        end: realEnd,
      }
    }

    // Regular quoted strings with prefix
    if (prefix && (sch === '"' || sch === "'")) {
      let j = si + 1
      while (j < code.length) {
        if (code[j] === '\\' && j + 1 < code.length) {
          j += 2
          continue
        }
        if (code[j] === sch) break
        j++
      }
      const realEnd = j + 1
      const content = code.substring(si + 1, j)
      return {
        value: content,
        quoteChar: sch,
        prefix: prefix,
        raw: code.substring(i, realEnd),
        end: realEnd,
      }
    }
  }

  // PowerShell here-strings @"..."@ and @'...'@
  if (language === 'powershell') {
    if (ch === '@' && (code[i + 1] === '"' || code[i + 1] === "'")) {
      const q = code[i + 1]
      const closer = q + '@'
      const end = code.indexOf(closer, i + 2)
      const realEnd = end === -1 ? code.length : end + 2
      const content = code.substring(i + 2, end === -1 ? code.length : end)
      return {
        value: content,
        quoteChar: '@' + q,
        raw: code.substring(i, realEnd),
        end: realEnd,
      }
    }
  }

  // C# interpolated strings $"..."
  if (language === 'csharp' && ch === '$' && code[i + 1] === '"') {
    let j = i + 2
    const escapeChar = '\\'
    while (j < code.length) {
      if (code[j] === escapeChar && j + 1 < code.length) { j += 2; continue }
      if (code[j] === '"') break
      j++
    }
    const realEnd = j + 1
    const content = code.substring(i + 2, j)
    return {
      value: content,
      quoteChar: '$"',
      prefix: '$',
      raw: code.substring(i, realEnd),
      end: realEnd,
    }
  }

  // C# verbatim strings @"..."
  if (language === 'csharp' && ch === '@' && code[i + 1] === '"') {
    let j = i + 2
    while (j < code.length) {
      if (code[j] === '"') {
        if (code[j + 1] === '"') {
          j += 2 // escaped quote in verbatim
          continue
        }
        break
      }
      j++
    }
    const realEnd = j + 1
    const content = code.substring(i + 2, j)
    return {
      value: content,
      quoteChar: '@"',
      raw: code.substring(i, realEnd),
      end: realEnd,
    }
  }

  // Bash $'...' (ANSI-C quoting - don't touch)
  if (language === 'bash' && ch === '$' && code[i + 1] === "'") {
    let j = i + 2
    while (j < code.length && code[j] !== "'") {
      if (code[j] === '\\') j++ // skip escaped
      j++
    }
    const realEnd = j + 1
    return {
      value: code.substring(i + 2, j),
      quoteChar: "$'",
      raw: code.substring(i, realEnd),
      end: realEnd,
    }
  }

  // Regular single and double quoted strings
  if (ch === '"' || ch === "'") {
    // Bash: single quotes have no escaping
    if (language === 'bash' && ch === "'") {
      const end = code.indexOf("'", i + 1)
      const realEnd = end === -1 ? code.length : end + 1
      const content = code.substring(i + 1, end === -1 ? code.length : end)
      return { value: content, quoteChar: ch, raw: code.substring(i, realEnd), end: realEnd }
    }

    // Standard escaped string
    let j = i + 1
    const escapeChar = language === 'powershell' ? '`' : '\\'
    while (j < code.length) {
      if (code[j] === escapeChar && j + 1 < code.length) {
        j += 2 // skip escape sequence
        continue
      }
      if (code[j] === ch) break
      j++
    }
    const realEnd = j + 1
    const content = code.substring(i + 1, j)
    return { value: content, quoteChar: ch, raw: code.substring(i, realEnd), end: realEnd }
  }

  // Go backtick strings
  if (language === 'go' && ch === '`') {
    const end = code.indexOf('`', i + 1)
    const realEnd = end === -1 ? code.length : end + 1
    const content = code.substring(i + 1, end === -1 ? code.length : end)
    return { value: content, quoteChar: '`', raw: code.substring(i, realEnd), end: realEnd }
  }

  return null
}

/**
 * Check if a string contains non-ASCII / Unicode characters
 * @param {string} str
 * @returns {boolean}
 */
export function hasUnicode(str) {
  return /[^\x00-\x7F]/.test(str)
}

/**
 * Check if a string contains variable interpolation
 * @param {string} content - String content (without quotes)
 * @param {string} language
 * @returns {boolean}
 */
export function hasInterpolation(content, language) {
  switch (language) {
    case 'powershell':
      // $var, ${var}, $(expr)
      return /\$[a-zA-Z_{\(]/.test(content)
    case 'bash':
      // $var, ${var}, $(cmd), `cmd`
      return /\$[a-zA-Z_{\(]/.test(content) || /`[^`]+`/.test(content)
    case 'csharp':
      // {varName} inside interpolated $"..." strings
      return /\{[a-zA-Z_][^}]*\}/.test(content)
    case 'python':
      // {expr} inside f-strings — but not {{ (escaped braces)
      return /(?<!\{)\{[a-zA-Z_][^}]*\}(?!\})/.test(content)
    default:
      return false
  }
}

/**
 * Split an interpolated string into static text and variable segments.
 * Only encode static segments; leave variable references intact.
 *
 * @param {string} content - String content (without quotes)
 * @param {string} language
 * @returns {{ type: 'static' | 'var', value: string }[]}
 */
export function splitInterpolatedString(content, language) {
  const segments = []
  let i = 0

  switch (language) {
    case 'powershell':
      return splitPowerShellInterpolation(content)
    case 'bash':
      return splitBashInterpolation(content)
    case 'csharp':
      return splitCSharpInterpolation(content)
    case 'python':
      return splitPythonFString(content)
    default:
      return [{ type: 'static', value: content }]
  }
}

/* ── PowerShell interpolation: $var, ${var}, $(expr) ─────── */

function splitPowerShellInterpolation(content) {
  const segments = []
  let i = 0
  let staticBuf = ''

  while (i < content.length) {
    if (content[i] === '`' && i + 1 < content.length) {
      // Escaped character — keep as static
      staticBuf += content[i] + content[i + 1]
      i += 2
      continue
    }

    if (content[i] === '$') {
      // Flush static buffer
      if (staticBuf) { segments.push({ type: 'static', value: staticBuf }); staticBuf = '' }

      if (content[i + 1] === '(') {
        // $(expression) — find matching paren
        let depth = 1
        let j = i + 2
        while (j < content.length && depth > 0) {
          if (content[j] === '(') depth++
          if (content[j] === ')') depth--
          j++
        }
        segments.push({ type: 'var', value: content.substring(i, j) })
        i = j
      } else if (content[i + 1] === '{') {
        // ${varName}
        const end = content.indexOf('}', i + 2)
        const j = end === -1 ? content.length : end + 1
        segments.push({ type: 'var', value: content.substring(i, j) })
        i = j
      } else if (/[a-zA-Z_]/.test(content[i + 1] || '')) {
        // $varName
        let j = i + 1
        while (j < content.length && /[a-zA-Z0-9_]/.test(content[j])) j++
        segments.push({ type: 'var', value: content.substring(i, j) })
        i = j
      } else {
        // Lone $ — keep as static
        staticBuf += '$'
        i++
      }
    } else {
      staticBuf += content[i]
      i++
    }
  }

  if (staticBuf) segments.push({ type: 'static', value: staticBuf })
  return segments
}

/* ── Bash interpolation: $var, ${var}, $(cmd), `cmd` ─────── */

function splitBashInterpolation(content) {
  const segments = []
  let i = 0
  let staticBuf = ''

  while (i < content.length) {
    if (content[i] === '\\' && i + 1 < content.length) {
      staticBuf += content[i] + content[i + 1]
      i += 2
      continue
    }

    if (content[i] === '$') {
      if (staticBuf) { segments.push({ type: 'static', value: staticBuf }); staticBuf = '' }

      if (content[i + 1] === '(') {
        // $(command)
        let depth = 1
        let j = i + 2
        while (j < content.length && depth > 0) {
          if (content[j] === '(') depth++
          if (content[j] === ')') depth--
          j++
        }
        segments.push({ type: 'var', value: content.substring(i, j) })
        i = j
      } else if (content[i + 1] === '{') {
        // ${varName}
        const end = content.indexOf('}', i + 2)
        const j = end === -1 ? content.length : end + 1
        segments.push({ type: 'var', value: content.substring(i, j) })
        i = j
      } else if (/[a-zA-Z_]/.test(content[i + 1] || '')) {
        // $varName
        let j = i + 1
        while (j < content.length && /[a-zA-Z0-9_]/.test(content[j])) j++
        segments.push({ type: 'var', value: content.substring(i, j) })
        i = j
      } else {
        staticBuf += '$'
        i++
      }
    } else if (content[i] === '`') {
      // `command` backtick substitution
      if (staticBuf) { segments.push({ type: 'static', value: staticBuf }); staticBuf = '' }
      const end = content.indexOf('`', i + 1)
      const j = end === -1 ? content.length : end + 1
      segments.push({ type: 'var', value: content.substring(i, j) })
      i = j
    } else {
      staticBuf += content[i]
      i++
    }
  }

  if (staticBuf) segments.push({ type: 'static', value: staticBuf })
  return segments
}

/* ── Python f-string interpolation: {expr} inside f"..." ── */

function splitPythonFString(content) {
  const segments = []
  let i = 0
  let staticBuf = ''

  while (i < content.length) {
    if (content[i] === '{' && content[i + 1] === '{') {
      // Escaped {{ → literal {
      staticBuf += '{'
      i += 2
      continue
    }
    if (content[i] === '}' && content[i + 1] === '}') {
      // Escaped }} → literal }
      staticBuf += '}'
      i += 2
      continue
    }

    if (content[i] === '{') {
      if (staticBuf) { segments.push({ type: 'static', value: staticBuf }); staticBuf = '' }
      // Find matching } (handle nested braces for expressions like {d[key]})
      let depth = 1
      let j = i + 1
      while (j < content.length && depth > 0) {
        if (content[j] === '{') depth++
        if (content[j] === '}') depth--
        j++
      }
      // Extract the expression inside {} (without braces)
      // Handle format specs: {var:.2f} → just take the var part before ':'
      const fullExpr = content.substring(i + 1, j - 1)
      // Split on ':' for format spec, but only top-level (not inside nested [])
      const colonIdx = fullExpr.indexOf(':')
      const expr = colonIdx !== -1 ? fullExpr.substring(0, colonIdx).trim() : fullExpr.trim()
      segments.push({ type: 'var', value: expr })
      i = j
    } else {
      staticBuf += content[i]
      i++
    }
  }

  if (staticBuf) segments.push({ type: 'static', value: staticBuf })
  return segments
}

/* ── C# interpolation: {varName}, {expr} inside $"..." ──── */

function splitCSharpInterpolation(content) {
  const segments = []
  let i = 0
  let staticBuf = ''

  while (i < content.length) {
    if (content[i] === '{' && content[i + 1] === '{') {
      // Escaped {{ → literal {
      staticBuf += '{'
      i += 2
      continue
    }
    if (content[i] === '}' && content[i + 1] === '}') {
      // Escaped }} → literal }
      staticBuf += '}'
      i += 2
      continue
    }

    if (content[i] === '{') {
      if (staticBuf) { segments.push({ type: 'static', value: staticBuf }); staticBuf = '' }
      // Find matching }
      let depth = 1
      let j = i + 1
      while (j < content.length && depth > 0) {
        if (content[j] === '{') depth++
        if (content[j] === '}') depth--
        j++
      }
      // Extract the expression inside {} (without braces)
      const expr = content.substring(i + 1, j - 1)
      segments.push({ type: 'var', value: expr })
      i = j
    } else {
      staticBuf += content[i]
      i++
    }
  }

  if (staticBuf) segments.push({ type: 'static', value: staticBuf })
  return segments
}

/**
 * Check if content is inside a structural block (class body, namespace, etc.)
 * Used by dead code injection to avoid inserting inside unsafe locations.
 * @param {string} line - Current line
 * @param {string} language
 * @returns {boolean} true if it's safe to inject dead code after this line
 */
export function isSafeForInjection(line, language) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
    return false
  }

  switch (language) {
    case 'csharp':
      // Don't inject after: class/namespace/struct declarations, using, {, }
      if (/^\s*(using |namespace |class |struct |interface |enum )/.test(line)) return false
      if (trimmed === '{' || trimmed === '}' || trimmed === '};') return false
      if (/^\s*(public|private|protected|internal|static)\s+(class|struct|interface|enum)\s/.test(line)) return false
      return true
    case 'go':
      if (/^\s*(package |import |type |func )/.test(line)) return false
      if (trimmed === '{' || trimmed === '}') return false
      return true
    case 'python':
      if (/^\s*(class |def |import |from )/.test(line)) return false
      if (trimmed === '' || trimmed.endsWith(':')) return false
      return true
    default:
      return trimmed !== '{' && trimmed !== '}' && trimmed !== ''
  }
}
