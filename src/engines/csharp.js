/**
 * C# Obfuscation Engine (v2 — Context-Aware)
 *
 * FIXED:
 * - Obfuscates ONLY content inside string literals ("...")
 * - Keeps using, method signatures, try/catch, foreach INTACT
 * - Uses new string(new char[] { ... }) for obfuscation
 * - Dead code never injected inside class/namespace declarations
 * - Verbatim strings @"..." preserved as-is
 * - Unicode → force Base64
 */

import { toBase64, xorEncryptForLanguage, resolveLanguageEscapes } from '../utils/encoding.js'
import { randomVarName, randomFuncName, generateDeadCode } from '../utils/randomization.js'
import { tokenize, tokensToCode, transformStrings, hasUnicode, hasInterpolation, splitInterpolatedString, isSafeForInjection } from '../utils/parser.js'
import { applyControlFlowFlattening } from './controlflow.js'
import { generateCSAmsiEtwBlock } from './amsi.js'

export function obfuscateCSharp(code, layers = []) {
  if (!code || code.trim().length === 0) return ''

  // C# 11 raw/interpolated raw strings require delimiter-aware parsing. Keep
  // the full compilation unit intact until the tokenizer models them.
  if (/"{3,}/.test(code)) return code

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
  if (layers.includes('controlflow')) {
    result = applyControlFlowFlattening(result, 'csharp')
  }
  if (layers.includes('deadcode')) {
    result = applyDeadCodeInjection(result)
  }
  if (layers.includes('antianalysis')) {
    result = applyAntiAnalysis(result)
  }
  if (layers.includes('amsietw')) {
    result = applyAmsiEtwPatch(result)
  }
  if (layers.includes('encrypt')) {
    result = applyEncryptionWrapper(result)
  }

  return result
}

/* ── Variable Randomization (context-aware) ──────────────── */

function applyVariableRandomization(code) {
  const reserved = new Set([
    'Main', 'args', 'Console', 'System', 'String', 'Math', 'Array',
    'Environment', 'Process', 'Thread', 'Marshal', 'IntPtr', 'Zero',
    'Encoding', 'Convert', 'Assembly', 'Type', 'Activator', 'File',
    'Directory', 'Path', 'Stream', 'StreamReader', 'StreamWriter',
    'TcpClient', 'WebClient', 'HttpClient', 'Task', 'Stopwatch',
    'StringBuilder', 'Byte', 'Int32', 'Int64', 'Boolean', 'Object',
    'Exception', 'EventArgs', 'true', 'false', 'null', 'void',
    'static', 'public', 'private', 'protected', 'internal', 'new',
    'class', 'struct', 'interface', 'enum', 'namespace', 'using',
    'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch',
    'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
    'var', 'int', 'string', 'bool', 'byte', 'double', 'float', 'long',
    'char', 'object', 'typeof', 'sizeof', 'is', 'as', 'in', 'out', 'ref',
    // .NET methods (dot-notation targets)
    'ToString', 'GetType', 'Equals', 'GetHashCode', 'Write', 'WriteLine',
    'Read', 'ReadLine', 'Close', 'Dispose', 'Sleep', 'Start', 'Stop',
    'Invoke', 'Load', 'Parse', 'TryParse', 'Split', 'Join', 'Replace',
    'Trim', 'Contains', 'Length', 'Count', 'Add', 'Remove', 'Clear',
    'ToArray', 'ToList', 'Copy', 'Format', 'Substring', 'StartsWith',
    'EndsWith', 'IndexOf', 'Insert', 'Append', 'GetBytes', 'GetString',
    'FromBase64String', 'ToBase64String', 'GetProcAddress', 'LoadLibrary',
    'VirtualProtect', 'EntryPoint', 'GetModules', 'SetValue', 'GetField',
  ])

  // Collect local variable declarations from CODE tokens only
  const tokens = tokenize(code, 'csharp')
  const varMap = {}

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\b(?:var|int|string|byte\[\]|bool|double|float|long|char|object)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !varMap[varName]) {
        varMap[varName] = randomVarName('camelCase')
      }
    }
  }

  // A regex-only renamer cannot safely distinguish user-defined members from
  // locals in every valid C# construct. If a collected identifier is accessed
  // through an object (this.value, obj.Member), keep it unchanged rather than
  // renaming only its declaration or an unrelated use.
  for (const varName of Object.keys(varMap)) {
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\.\\s*${escaped}\\b`).test(code)) delete varMap[varName]
  }

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename identifiers in text
  const renameVarsInText = (text) => {
    let result = text
    for (const varName of sortedVars) {
      const regex = new RegExp('(?<!\\.)\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
      result = result.replace(regex, varMap[varName])
    }
    return result
  }

  // Process ALL tokens: code + interpolated $"..." strings
  const transformed = tokens.map(token => {
    if (token.type === 'code') {
      return { ...token, value: renameVarsInText(token.value) }
    }
    // Rename inside C# interpolated strings $"..."
    // {varName} expressions inside $"..." need their identifiers renamed
    if (token.type === 'string' && (token.quoteChar === '$"' || token.prefix?.includes('$'))) {
      // Rename identifiers inside {expr} placeholders, leave static text alone
      const newValue = token.value.replace(/\{([^}]+)\}/g, (match, expr) => {
        return '{' + renameVarsInText(expr) + '}'
      })
      return { ...token, value: newValue, raw: `${token.quoteChar}${newValue}"` }
    }
    return token
  })

  return tokensToCode(transformed)
}

/* ── Encode a single static C# text segment ─────────────── */

function encodeStaticCS(rawText) {
  if (!rawText) return ''
  const text = resolveLanguageEscapes(rawText, 'csharp')
  if (hasUnicode(text)) {
    return `System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String("${toBase64(text)}"))`
  }
  const method = Math.floor(Math.random() * 2)
  if (method === 0) {
    const chars = Array.from(text).map(c => `(char)${c.charCodeAt(0)}`).join(', ')
    return `new string(new char[] {${chars}})`
  }
  const bytes = Array.from(text).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(', ')
  return `System.Text.Encoding.ASCII.GetString(new byte[] {${bytes}})`
}

/* ── String Encoding (interpolation-aware) ───────────────── */

function applyStringEncoding(code) {
  const tokens = tokenize(code, 'csharp')

  const transformed = transformStrings(tokens, (content, quoteChar, prefix) => {
    if (quoteChar === '@"') return `@"${content}"`
    if (quoteChar === '$@"' || quoteChar === '@$"') return `${quoteChar}${content}"`
    if (quoteChar === "'") return `'${content}'`

    // C# interpolated string $"..." → String.Format(encoded, vars...)
    if (quoteChar === '$"' || prefix === '$') {
      if (hasInterpolation(content, 'csharp')) {
        const segments = splitInterpolatedString(content, 'csharp')
        const vars = []
        let formatStr = ''
        for (const seg of segments) {
          if (seg.type === 'var') {
            formatStr += `{${vars.length}${seg.format || ''}}`
            vars.push(seg.value) // raw expression e.g. "numberA"
          } else {
            // String.Format treats braces as control characters. Braces that
            // were escaped in the interpolated source must remain literal.
            formatStr += seg.value.replaceAll('{', '{{').replaceAll('}', '}}')
          }
        }
        const encodedFormat = encodeStaticCS(formatStr)
        return `string.Format(${encodedFormat}, ${vars.join(', ')})`
      }
      // No interpolation in $"..." — encode as regular string
      return encodeStaticCS(content)
    }

    // Regular string — no interpolation possible, encode entire
    if (hasUnicode(content)) {
      return `System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String("${toBase64(content)}"))`
    }
    return encodeStaticCS(content)
  })

  return tokensToCode(transformed)
}

/* ── XOR String Encryption (interpolation-aware) ─────────── */

function applyXorStringEncryption(code) {
  // Distinct prefixes guarantee that the generated method never has the same
  // name as its containing class (which C# would parse as an invalid member).
  const helperClassName = '_C' + randomFuncName()
  const funcName = '_D' + randomFuncName()
  const qualifiedFuncName = `${helperClassName}.${funcName}`
  let helperInjected = false
  const tokens = tokenize(code, 'csharp')

  const transformed = transformStrings(tokens, (content, quoteChar, prefix) => {
    if (quoteChar === '@"') return `@"${content}"`
    if (quoteChar === '$@"' || quoteChar === '@$"') return `${quoteChar}${content}"`
    if (quoteChar === "'") return `'${content}'`
    if (content.length < 3) return quoteChar === '$"' ? `$"${content}"` : `"${content}"`

    // Interpolated $"..." → String.Format(XOR_encoded, vars...)
    if (quoteChar === '$"' || prefix === '$') {
      if (hasInterpolation(content, 'csharp')) {
        const segments = splitInterpolatedString(content, 'csharp')
        const vars = []
        let formatStr = ''
        for (const seg of segments) {
          if (seg.type === 'var') {
            formatStr += `{${vars.length}${seg.format || ''}}`
            vars.push(seg.value)
          } else {
            formatStr += seg.value.replaceAll('{', '{{').replaceAll('}', '}}')
          }
        }
        if (formatStr.length >= 3) {
          const xor = xorEncryptForLanguage(formatStr, 'csharp', qualifiedFuncName)
          if (!helperInjected) helperInjected = true
          return `string.Format(${xor.inline}, ${vars.join(', ')})`
        }
        return `$"${content}"`
      }
    }

    const xor = xorEncryptForLanguage(content, 'csharp', qualifiedFuncName)
    if (!helperInjected) helperInjected = true
    return xor.inline
  })

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'csharp', funcName).helper
    // A top-level helper is reachable from every class in the compilation
    // unit. Injecting into the "second brace" broke files without namespaces
    // (inside the first method) and files with multiple classes.
    result += `\ninternal static class ${helperClassName}\n{\n    ${helper.replace(/^static string /, 'internal static string ')}\n}\n`
  }
  return result
}

/* ── Dead Code Injection (safe locations only) ───────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []
  let braceDepth = 0
  let methodDepth = null
  let pendingMethod = false

  const stripNonCode = (line) => {
    let output = ''
    let quote = ''
    let escaped = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (!quote && ch === '/' && line[i + 1] === '/') break
      if (escaped) { escaped = false; output += ' '; continue }
      if (quote && ch === '\\') { escaped = true; output += ' '; continue }
      if (ch === '"' || ch === "'") {
        if (!quote) quote = ch
        else if (quote === ch) quote = ''
        output += ' '
        continue
      }
      output += quote ? ' ' : ch
    }
    return output
  }

  const looksLikeMethod = (line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.endsWith(';') || /^(?:if|for|foreach|while|switch|catch|using|lock)\b/.test(trimmed)) return false
    return /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\([^;]*\)\s*(?:where\b[^{}]*)?\{?\s*$/.test(trimmed)
  }

  for (let i = 0; i < lines.length; i++) {
    const masked = stripNonCode(lines[i])
    const trimmed = masked.trim()
    if (methodDepth === null && looksLikeMethod(masked)) pendingMethod = true

    const beforeDepth = braceDepth
    for (const ch of masked) {
      if (ch === '{') braceDepth++
      if (ch === '}') braceDepth--
    }
    if (pendingMethod && braceDepth > beforeDepth) {
      methodDepth = braceDepth
      pendingMethod = false
    }

    result.push(lines[i])

    // Only inject after complete statements inside a method. This avoids
    // landing between try and its brace, between switch labels, or after a
    // terminator where declarations would be unreachable/invalid.
    const safeStatement = trimmed.endsWith(';') &&
      !/^(?:case\b|default\s*:|return\b|break\b|continue\b|throw\b|goto\b|yield\b)/.test(trimmed)
    if (methodDepth !== null && braceDepth >= methodDepth && safeStatement &&
        i > 0 && i % (4 + Math.floor(Math.random() * 3)) === 0) {
      if (isSafeForInjection(masked, 'csharp')) {
        const indent = lines[i].match(/^(\s*)/)?.[1] || '        '
        result.push(indent + generateDeadCode('csharp'))
      }
    }

    if (methodDepth !== null && braceDepth < methodDepth) methodDepth = null
  }

  return result.join('\n')
}

/* ── Anti-Analysis ───────────────────────────────────────── */

function applyAntiAnalysis(code) {
  const v1 = randomVarName('camelCase')
  const v2 = randomVarName('camelCase')
  const sleepMs = 1000 + Math.floor(Math.random() * 4000)

  const antiAnalysis = `        // Environment validation
        var ${v1} = System.Environment.ProcessorCount;
        if (${v1} < 2) return;
        var ${v2} = System.Diagnostics.Stopwatch.StartNew();
        System.Threading.Thread.Sleep(${sleepMs});
        ${v2}.Stop();
        if (${v2}.ElapsedMilliseconds < ${Math.floor(sleepMs * 0.8)}) return;`

  // Insert after first '{' in Main method
  const mainIndex = code.indexOf('static void Main')
  if (mainIndex !== -1) {
    const braceIndex = code.indexOf('{', mainIndex)
    if (braceIndex !== -1) {
      return code.substring(0, braceIndex + 1) + '\n' + antiAnalysis + '\n' + code.substring(braceIndex + 1)
    }
  }

  // Unsupported entry-point shapes (for example int/async/top-level Main)
  // are left intact instead of emitting statements at compilation-unit scope.
  return code
}

/* ── AMSI/ETW In-Memory Patch ────────────────────────────── */

function applyAmsiEtwPatch(code) {
  const { patchCode, pInvokes } = generateCSAmsiEtwBlock()

  // Add using System.Runtime.InteropServices if missing
  let result = code
  if (!result.includes('System.Runtime.InteropServices')) {
    result = result.replace(/^(using System;)/m, '$1\nusing System.Runtime.InteropServices;')
  }

  // Insert P/Invoke declarations after class opening brace
  const classMatch = result.match(/class\s+\w+[^{]*\{/)
  if (classMatch) {
    const classEnd = result.indexOf(classMatch[0]) + classMatch[0].length
    result = result.substring(0, classEnd) + '\n' + pInvokes + '\n' + result.substring(classEnd)
  }

  // Insert patch code at start of Main method
  const mainIndex = result.indexOf('static void Main')
  if (mainIndex !== -1) {
    const braceIndex = result.indexOf('{', mainIndex)
    if (braceIndex !== -1) {
      result = result.substring(0, braceIndex + 1) + '\n' + patchCode + '\n' + result.substring(braceIndex + 1)
    }
  }

  return result
}

/* ── Semantic-preserving encryption pass ─────────────────── */

function applyEncryptionWrapper(code) {
  // C# source cannot execute a decrypted source string without introducing a
  // runtime compiler dependency. The previous wrappers therefore printed the
  // source instead of running the program. Use the compile-time-safe string
  // encryption pass so the produced program remains a normal executable with
  // identical behavior.
  return applyXorStringEncryption(code)
}
