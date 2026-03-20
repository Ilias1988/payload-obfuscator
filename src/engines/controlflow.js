/**
 * Control Flow Flattening Engine (v4.0 Platinum)
 *
 * Splits code into blocks and wraps them in a state-machine
 * (while + switch) with randomized state transitions.
 * Defeats CFG analysis and decompiler pattern recognition.
 *
 * Supported: PowerShell, C#, Go
 */

import { randomVarName } from '../utils/randomization'
import { tokenize } from '../utils/parser'

/**
 * Split code into executable blocks (context-aware — avoids splitting strings)
 * @param {string} code
 * @param {string} language
 * @returns {string[]}
 */
function splitIntoBlocks(code, language) {
  const tokens = tokenize(code, language)
  const flatCode = tokens.map(t => {
    if (t.type === 'string') return t.raw || `${t.quoteChar}${t.value}${t.quoteChar}`
    return t.value
  }).join('')

  // Split by lines, merge very short lines into previous block
  const rawLines = flatCode.split('\n').filter(l => l.trim().length > 0)
  const blocks = []
  let currentBlock = ''

  for (const line of rawLines) {
    const trimmed = line.trim()

    // Skip standalone comments — attach to next block
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      currentBlock += line + '\n'
      continue
    }

    // Skip structural lines (using, import, package, etc.) — keep as preamble
    if (language === 'csharp' && /^\s*(using |namespace |\[DllImport|class |static )/.test(line)) {
      currentBlock += line + '\n'
      continue
    }
    if (language === 'go' && /^\s*(package |import |func |type )/.test(line)) {
      currentBlock += line + '\n'
      continue
    }

    // Skip braces on their own
    if (trimmed === '{' || trimmed === '}' || trimmed === '};') {
      currentBlock += line + '\n'
      continue
    }

    currentBlock += line + '\n'

    // End block on semicolons (C#/Go) or complete statements
    if (trimmed.endsWith(';') || trimmed.endsWith(')') ||
        trimmed.endsWith('}') || (!trimmed.endsWith('{') && !trimmed.endsWith(','))) {
      if (currentBlock.trim().length > 0) {
        blocks.push(currentBlock.trimEnd())
        currentBlock = ''
      }
    }
  }

  if (currentBlock.trim().length > 0) {
    blocks.push(currentBlock.trimEnd())
  }

  // Merge blocks that are too small (< 30 chars) with previous
  const merged = []
  for (const block of blocks) {
    if (merged.length > 0 && block.trim().length < 30) {
      merged[merged.length - 1] += '\n' + block
    } else {
      merged.push(block)
    }
  }

  return merged.length > 1 ? merged : blocks
}

/**
 * Generate unique random state numbers
 * @param {number} count
 * @returns {number[]}
 */
function generateStateNumbers(count) {
  const states = new Set()
  while (states.size < count + 1) { // +1 for exit state
    states.add(100 + Math.floor(Math.random() * 900))
  }
  return [...states]
}

/**
 * Shuffle an array (Fisher-Yates)
 * @param {any[]} arr
 * @returns {any[]}
 */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Apply Control Flow Flattening
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
export function applyControlFlowFlattening(code, language) {
  const blocks = splitIntoBlocks(code, language)

  // Need at least 3 blocks for flattening to make sense
  if (blocks.length < 3) return code

  const stateVar = randomVarName('short')
  const states = generateStateNumbers(blocks.length)
  const exitState = states[states.length - 1]

  // Create execution order: block[i] → states[i], transitions to states[i+1]
  const cases = blocks.map((block, i) => ({
    state: states[i],
    code: block,
    nextState: i < blocks.length - 1 ? states[i + 1] : exitState,
  }))

  // Shuffle the cases inside the switch (the magic of CFF)
  const shuffledCases = shuffle(cases)
  const initialState = states[0]

  switch (language) {
    case 'powershell':
      return generatePowerShellCFF(stateVar, initialState, exitState, shuffledCases)
    case 'csharp':
      return generateCSharpCFF(stateVar, initialState, exitState, shuffledCases)
    case 'go':
      return generateGoCFF(stateVar, initialState, exitState, shuffledCases)
    default:
      return code
  }
}

/* ── PowerShell CFF ──────────────────────────────────────── */

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

/* ── C# CFF ──────────────────────────────────────────────── */

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

/* ── Go CFF ──────────────────────────────────────────────── */

function generateGoCFF(stateVar, initialState, exitState, cases) {
  let output = `${stateVar} := ${initialState}\nfor {\n    switch ${stateVar} {\n`

  for (const c of cases) {
    const indented = c.code.split('\n').map(l => '        ' + l).join('\n')
    output += `    case ${c.state}:\n${indented}\n        ${stateVar} = ${c.nextState}\n`
  }

  output += `    case ${exitState}:\n        break\n    }\n    if ${stateVar} == ${exitState} { break }\n}`

  return output
}
