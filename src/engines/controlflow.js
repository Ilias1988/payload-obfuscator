/**
 * Control Flow Flattening Engine (v4.1 Diamond)
 *
 * Scope-Aware CFF: splits code into blocks ONLY at braceDepth === 0.
 * Nested scopes (loops, if/else, try/catch) remain intact as atomic blocks.
 * Pipeline-safe: PowerShell pipes treated as single statements.
 * Safe Mode: skips CFF if code is too complex or malformed.
 *
 * Supported: PowerShell, C#, Go
 */

import { randomVarName } from '../utils/randomization'

/* ══════════════════════════════════════════════════════════════
 *  SCOPE-AWARE BLOCK EXTRACTION
 * ══════════════════════════════════════════════════════════════ */

/**
 * Language-specific preamble patterns (never flattened)
 */
const PREAMBLE_PATTERNS = {
  powershell: /^\s*(#\s*requires|param\s*\(|using\s+)/i,
  csharp: /^\s*(using\s+|namespace\s+|\[assembly:|#region|#pragma)/,
  go: /^\s*(package\s+|import\s+)/,
}

/**
 * Compound statement keywords that start atomic blocks (absorb until braceDepth returns to base)
 */
const COMPOUND_STARTS = {
  powershell: /^\s*(try|if|else|elseif|for|foreach|while|do|switch|trap)\b/i,
  csharp: /^\s*(try|if|else|for|foreach|while|do|switch|lock|using\s*\()\b/,
  go: /^\s*(if|else|for|switch|select|go\s+func)\b/,
}

/**
 * Detect if a line continues a compound block (catch, finally, else, elif)
 */
const CONTINUATION_KEYWORDS = {
  powershell: /^\s*(catch|finally|elseif|else)\b/i,
  csharp: /^\s*(catch|finally|else)\b/,
  go: /^\s*(else)\b/,
}

/**
 * Detect PowerShell pipeline continuation (line ends with | or starts with |)
 */
function isPipelineContinuation(line) {
  const t = line.trim()
  return t.endsWith('|') || t.startsWith('|')
}

/**
 * Check if a line is purely structural (class/func declaration, standalone braces)
 */
function isStructuralLine(line, language) {
  const t = line.trim()
  if (t === '{' || t === '}' || t === '};' || t === '') return true
  if (language === 'csharp' && /^\s*(class\s+|static\s+void\s+Main|public\s+|private\s+|protected\s+|internal\s+|static\s+\w+\s+\w+\s*\()/.test(line)) return true
  if (language === 'go' && /^\s*(func\s+|type\s+)/.test(line)) return true
  return false
}

/**
 * Count net brace change in a line (ignoring braces inside strings/comments)
 * Simple but effective: counts { and } characters outside of quotes
 */
function countBracesDelta(line) {
  let delta = 0
  let inSingle = false
  let inDouble = false
  let escaped = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue }
    if (inSingle || inDouble) continue
    if (ch === '{') delta++
    if (ch === '}') delta--
  }
  return delta
}

/**
 * Extract preamble (lines that should never be inside the state machine)
 * and body (lines to be flattened).
 */
function extractPreambleAndBody(code, language) {
  const lines = code.split('\n')
  const preamble = []
  const body = []
  const pattern = PREAMBLE_PATTERNS[language]
  let braceDepth = 0
  let inPreamble = true

  for (const line of lines) {
    const trimmed = line.trim()

    // Track braces
    const delta = countBracesDelta(line)

    if (inPreamble) {
      // Preamble: keep collecting until we hit the first executable code
      if (pattern && pattern.test(line)) {
        preamble.push(line)
        braceDepth += delta
        continue
      }
      // For C#: class declaration + its opening brace = preamble
      if (language === 'csharp' && /^\s*(class\s+|static\s+class\s+|\[DllImport)/.test(line)) {
        preamble.push(line)
        braceDepth += delta
        continue
      }
      // For Go: import block (may span multiple lines)
      if (language === 'go' && (trimmed.startsWith('import') || (braceDepth > 0 && preamble.some(p => p.trim().startsWith('import'))))) {
        preamble.push(line)
        braceDepth += delta
        continue
      }
      // Standalone opening brace after class/namespace = still preamble
      if (trimmed === '{' && braceDepth === 0) {
        preamble.push(line)
        braceDepth += delta
        continue
      }
      // Comments at top = preamble
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed === '') {
        preamble.push(line)
        continue
      }
      // Method signature in C# (static void Main, etc.)
      if (language === 'csharp' && /^\s*(static\s+void\s+Main|public\s+static|private\s+static)/.test(line)) {
        preamble.push(line)
        braceDepth += delta
        continue
      }
      // func main() in Go
      if (language === 'go' && /^\s*func\s+\w+/.test(line)) {
        preamble.push(line)
        braceDepth += delta
        continue
      }

      // First real code line → switch to body
      inPreamble = false
    }

    body.push(line)
  }

  return { preamble, body }
}

/**
 * Scope-Aware Block Splitter
 *
 * Rules:
 * 1. Only split when braceDepth === 0
 * 2. try/catch/finally → atomic (absorb continuation keywords)
 * 3. Compound statements (if/for/while) → atomic until braceDepth returns to 0
 * 4. PowerShell pipelines → merge into single block
 * 5. Structural lines (standalone braces) → attach to current block
 */
function splitIntoBlocks(bodyLines, language) {
  const blocks = []
  let currentBlock = []
  let braceDepth = 0
  let inCompound = false // inside a compound statement (try/if/for...)

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i]
    const trimmed = line.trim()

    // Skip empty lines — attach to current block
    if (trimmed === '') {
      currentBlock.push(line)
      continue
    }

    const delta = countBracesDelta(line)
    const prevDepth = braceDepth
    braceDepth += delta

    // Always add line to current block
    currentBlock.push(line)

    // PowerShell pipeline: if line ends with |, don't break
    if (language === 'powershell' && isPipelineContinuation(line)) {
      inCompound = true
      continue
    }

    // If we opened a brace, we're in a compound now
    if (braceDepth > 0) {
      inCompound = true
      continue
    }

    // braceDepth just returned to 0 — check for continuations
    if (prevDepth > 0 && braceDepth === 0) {
      // Look ahead: is next line a continuation keyword (catch, finally, else)?
      const nextLine = i + 1 < bodyLines.length ? bodyLines[i + 1] : ''
      const contPattern = CONTINUATION_KEYWORDS[language]
      if (contPattern && contPattern.test(nextLine)) {
        // Don't break — absorb the continuation
        continue
      }

      // Compound block complete — flush as single block
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'))
        currentBlock = []
      }
      inCompound = false
      continue
    }

    // At depth 0, not in compound — this is a simple statement
    if (braceDepth === 0 && !inCompound) {
      // Check if this line starts a compound statement
      const compoundPattern = COMPOUND_STARTS[language]
      if (compoundPattern && compoundPattern.test(line)) {
        // If brace opened and closed on same line (unlikely but possible)
        if (delta === 0 && !line.includes('{')) {
          // Single-line compound (e.g., `if (x) return;` in Go)
          blocks.push(currentBlock.join('\n'))
          currentBlock = []
          continue
        }
        // Otherwise compound started — wait for it to close
        inCompound = true
        continue
      }

      // Structural line (standalone brace) — don't break
      if (isStructuralLine(line, language)) {
        continue
      }

      // Simple statement at depth 0 — flush
      // But check: does next line start with continuation?
      const nextLine = i + 1 < bodyLines.length ? bodyLines[i + 1] : ''
      const contPattern = CONTINUATION_KEYWORDS[language]
      if (contPattern && contPattern.test(nextLine)) {
        continue
      }

      blocks.push(currentBlock.join('\n'))
      currentBlock = []
    }
  }

  // Flush remaining
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'))
  }

  return blocks.filter(b => b.trim().length > 0)
}

/* ══════════════════════════════════════════════════════════════
 *  UTILITIES
 * ══════════════════════════════════════════════════════════════ */

function generateStateNumbers(count) {
  const states = new Set()
  while (states.size < count + 1) {
    states.add(100 + Math.floor(Math.random() * 900))
  }
  return [...states]
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ══════════════════════════════════════════════════════════════
 *  MAIN ENTRY POINT
 * ══════════════════════════════════════════════════════════════ */

/**
 * Apply Control Flow Flattening (Scope-Aware)
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
export function applyControlFlowFlattening(code, language) {
  // ── SAFE MODE CHECK ──────────────────────────
  // Verify braces are balanced before proceeding
  let totalBraces = 0
  for (const ch of code) {
    if (ch === '{') totalBraces++
    if (ch === '}') totalBraces--
  }
  if (totalBraces !== 0) {
    // Malformed input — skip CFF entirely
    return code
  }

  const { preamble, body } = extractPreambleAndBody(code, language)
  const blocks = splitIntoBlocks(body, language)

  // Need at least 3 blocks for flattening to be useful
  if (blocks.length < 3) return code

  const stateVar = randomVarName('short')
  const states = generateStateNumbers(blocks.length)
  const exitState = states[states.length - 1]

  const cases = blocks.map((block, i) => ({
    state: states[i],
    code: block,
    nextState: i < blocks.length - 1 ? states[i + 1] : exitState,
  }))

  const shuffledCases = shuffle(cases)
  const initialState = states[0]

  let cffBody
  switch (language) {
    case 'powershell':
      cffBody = generatePowerShellCFF(stateVar, initialState, exitState, shuffledCases)
      break
    case 'csharp':
      cffBody = generateCSharpCFF(stateVar, initialState, exitState, shuffledCases)
      break
    case 'go':
      cffBody = generateGoCFF(stateVar, initialState, exitState, shuffledCases)
      break
    default:
      return code
  }

  // Reassemble: preamble + CFF body
  return preamble.join('\n') + '\n' + cffBody
}

/* ══════════════════════════════════════════════════════════════
 *  LANGUAGE-SPECIFIC GENERATORS
 * ══════════════════════════════════════════════════════════════ */

function generatePowerShellCFF(stateVar, initialState, exitState, cases) {
  let output = `$${stateVar} = ${initialState}\nwhile ($true) {\n    switch ($${stateVar}) {\n`

  for (const c of cases) {
    const indented = c.code.split('\n').map(l => '            ' + l).join('\n')
    output += `        ${c.state} {\n${indented}\n            $${stateVar} = ${c.nextState}; break\n        }\n`
  }

  output += `        ${exitState} { break }\n`
  output += `    }\n    if ($${stateVar} -eq ${exitState}) { break }\n}`
  return output
}

function generateCSharpCFF(stateVar, initialState, exitState, cases) {
  let output = `int ${stateVar} = ${initialState};\nwhile (true) {\n    switch (${stateVar}) {\n`

  for (const c of cases) {
    const indented = c.code.split('\n').map(l => '            ' + l).join('\n')
    output += `        case ${c.state}:\n${indented}\n            ${stateVar} = ${c.nextState}; break;\n`
  }

  output += `        case ${exitState}: goto _exit;\n`
  output += `    }\n}\n_exit:;`
  return output
}

function generateGoCFF(stateVar, initialState, exitState, cases) {
  let output = `${stateVar} := ${initialState}\nfor {\n    switch ${stateVar} {\n`

  for (const c of cases) {
    const indented = c.code.split('\n').map(l => '        ' + l).join('\n')
    output += `    case ${c.state}:\n${indented}\n        ${stateVar} = ${c.nextState}\n`
  }

  output += `    case ${exitState}:\n        break\n    }\n    if ${stateVar} == ${exitState} { break }\n}`
  return output
}
