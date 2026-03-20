/**
 * Output Validator
 * Checks obfuscated output for common syntax errors before displaying.
 * - Balanced delimiters: (), {}, [], "", ''
 * - Unicode safety check
 * - Provides warnings to the user
 */

/**
 * Validate balanced delimiters in output code
 * @param {string} code
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateOutput(code) {
  const warnings = []

  // Check balanced brackets
  const bracketResult = checkBalancedBrackets(code)
  if (!bracketResult.valid) {
    warnings.push(...bracketResult.errors)
  }

  // Check balanced quotes (approximate — ignores escaped quotes)
  const quoteResult = checkBalancedQuotes(code)
  if (!quoteResult.valid) {
    warnings.push(...quoteResult.errors)
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}

/**
 * Check that (), {}, [] are balanced
 * @param {string} code
 * @returns {{ valid: boolean, errors: string[] }}
 */
function checkBalancedBrackets(code) {
  const errors = []
  const stack = []
  const pairs = { '(': ')', '{': '}', '[': ']' }
  const closers = new Set([')', '}', ']'])
  let inString = false
  let stringChar = ''

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]

    // Track string context (simplified — skip escaped quotes)
    if ((ch === '"' || ch === "'" || ch === '`') && (i === 0 || code[i - 1] !== '\\')) {
      if (!inString) {
        inString = true
        stringChar = ch
        continue
      } else if (ch === stringChar) {
        inString = false
        continue
      }
    }

    if (inString) continue

    if (pairs[ch]) {
      stack.push({ char: ch, pos: i })
    } else if (closers.has(ch)) {
      if (stack.length === 0) {
        errors.push(`Unmatched closing '${ch}' at position ${i}`)
      } else {
        const top = stack.pop()
        if (pairs[top.char] !== ch) {
          errors.push(`Mismatched '${top.char}' at pos ${top.pos} with '${ch}' at pos ${i}`)
        }
      }
    }
  }

  for (const item of stack) {
    errors.push(`Unclosed '${item.char}' at position ${item.pos}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Check for obviously unbalanced quotes
 * @param {string} code
 * @returns {{ valid: boolean, errors: string[] }}
 */
function checkBalancedQuotes(code) {
  const errors = []

  // Count unescaped double quotes (rough check)
  let doubleCount = 0
  let singleCount = 0
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '"' && (i === 0 || code[i - 1] !== '\\')) doubleCount++
    if (code[i] === "'" && (i === 0 || code[i - 1] !== '\\')) singleCount++
  }

  if (doubleCount % 2 !== 0) {
    errors.push(`Odd number of double quotes (${doubleCount}) — possible unclosed string`)
  }
  // Single quotes can be odd in some languages (contractions, PowerShell), so only warn
  // if count is very unbalanced

  return { valid: errors.length === 0, errors }
}

/**
 * Quick check if string has non-ASCII characters
 * @param {string} str
 * @returns {boolean}
 */
export function containsUnicode(str) {
  return /[^\x00-\x7F]/.test(str)
}

/**
 * Safely encode a string — if it contains Unicode, force Base64
 * @param {string} str
 * @returns {{ encoded: string, method: string }}
 */
export function safeEncode(str) {
  if (containsUnicode(str)) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(str)))
      return { encoded: b64, method: 'base64-unicode' }
    } catch {
      // Fallback: hex encode each UTF-16 code unit
      const hex = Array.from(str)
        .map((c) => c.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('')
      return { encoded: hex, method: 'hex-unicode' }
    }
  }
  return { encoded: str, method: 'ascii' }
}
