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

import { toBase64, xorEncryptForLanguage } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'
import { tokenize, tokensToCode, transformStrings, transformCodeOnly, hasUnicode, hasInterpolation, splitInterpolatedString, isSafeForInjection } from '../utils/parser'
import { applyControlFlowFlattening } from './controlflow'
import { generateCSAmsiEtwBlock } from './amsi'

export function obfuscateCSharp(code, layers = []) {
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
  ])

  // Collect local variable declarations from CODE tokens only
  const tokens = tokenize(code, 'csharp')
  const varMap = {}

  for (const token of tokens) {
    if (token.type !== 'code') continue
    const varPattern = /\b(?:var|int|string|byte\[\]|bool|double|float|long|char|object)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    let match
    while ((match = varPattern.exec(token.value)) !== null) {
      const varName = match[1]
      if (!reserved.has(varName) && !varMap[varName]) {
        varMap[varName] = randomVarName('camelCase')
      }
    }
  }

  if (Object.keys(varMap).length === 0) return code

  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)

  // Helper: rename identifiers in text
  const renameVarsInText = (text) => {
    let result = text
    for (const varName of sortedVars) {
      const regex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
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
    if (token.type === 'string' && (token.quoteChar === '$"' || token.prefix === '$')) {
      // Rename identifiers inside {expr} placeholders, leave static text alone
      const newValue = token.value.replace(/\{([^}]+)\}/g, (match, expr) => {
        return '{' + renameVarsInText(expr) + '}'
      })
      return { ...token, value: newValue, raw: `$"${newValue}"` }
    }
    return token
  })

  return tokensToCode(transformed)
}

/* ── Encode a single static C# text segment ─────────────── */

function encodeStaticCS(text) {
  if (!text) return ''
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
    if (quoteChar === "'" && content.length <= 2) return `'${content}'`

    // C# interpolated string $"..." → String.Format(encoded, vars...)
    if (quoteChar === '$"' || prefix === '$') {
      if (hasInterpolation(content, 'csharp')) {
        const segments = splitInterpolatedString(content, 'csharp')
        const vars = []
        let formatStr = ''
        for (const seg of segments) {
          if (seg.type === 'var') {
            formatStr += `{${vars.length}}`
            vars.push(seg.value) // raw expression e.g. "numberA"
          } else {
            formatStr += seg.value
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
  const funcName = '_' + randomFuncName()
  let helperInjected = false
  const tokens = tokenize(code, 'csharp')

  const transformed = transformStrings(tokens, (content, quoteChar, prefix) => {
    if (quoteChar === '@"') return `@"${content}"`
    if (quoteChar === "'" && content.length <= 2) return `'${content}'`
    if (content.length < 3) return quoteChar === '$"' ? `$"${content}"` : `"${content}"`

    // Interpolated $"..." → String.Format(XOR_encoded, vars...)
    if (quoteChar === '$"' || prefix === '$') {
      if (hasInterpolation(content, 'csharp')) {
        const segments = splitInterpolatedString(content, 'csharp')
        const vars = []
        let formatStr = ''
        for (const seg of segments) {
          if (seg.type === 'var') {
            formatStr += `{${vars.length}}`
            vars.push(seg.value)
          } else {
            formatStr += seg.value
          }
        }
        if (formatStr.length >= 3) {
          const xor = xorEncryptForLanguage(formatStr, 'csharp', funcName)
          if (!helperInjected) helperInjected = true
          return `string.Format(${xor.inline}, ${vars.join(', ')})`
        }
        return `$"${content}"`
      }
    }

    const xor = xorEncryptForLanguage(content, 'csharp', funcName)
    if (!helperInjected) helperInjected = true
    return xor.inline
  })

  let result = tokensToCode(transformed)
  if (helperInjected) {
    const helper = xorEncryptForLanguage('x', 'csharp', funcName).helper
    const classInsert = result.indexOf('{')
    if (classInsert !== -1) {
      const secondBrace = result.indexOf('{', classInsert + 1)
      if (secondBrace !== -1) {
        result = result.substring(0, secondBrace) + '{\n    ' + helper + '\n' + result.substring(secondBrace + 1)
      } else {
        result = result.substring(0, classInsert + 1) + '\n    ' + helper + '\n' + result.substring(classInsert + 1)
      }
    }
  }
  return result
}

/* ── Dead Code Injection (safe locations only) ───────────── */

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    // Track brace depth to know if we're inside a method body
    for (const ch of trimmed) {
      if (ch === '{') braceDepth++
      if (ch === '}') braceDepth--
    }

    result.push(lines[i])

    // Only inject inside method bodies (depth >= 2: namespace + class + method)
    if (i > 0 && i % (4 + Math.floor(Math.random() * 3)) === 0 && braceDepth >= 2) {
      if (isSafeForInjection(lines[i], 'csharp')) {
        const indent = lines[i].match(/^(\s*)/)?.[1] || '        '
        result.push(indent + generateDeadCode('csharp'))
      }
    }
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

  return '// Anti-analysis\n' + antiAnalysis + '\n' + code
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

/* ── Polymorphic Encryption Wrapper (v4.5) ───────────────── */

function csJunk() {
  const pool = [
    () => `        var ${randomVarName('camelCase')} = (${Math.floor(Math.random()*999)} * ${Math.floor(Math.random()*99)} + ${Math.floor(Math.random()*9999)}) % 256;`,
    () => `        var ${randomVarName('camelCase')} = BitConverter.GetBytes(${Math.floor(Math.random()*0xFFFFFF)});`,
    () => `        var ${randomVarName('camelCase')} = "${Array.from({length: 6}, () => String.fromCharCode(65 + Math.floor(Math.random()*26))).join('')}";`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function csLoopJunk() {
  const pool = [
    () => `            var _ = (i * ${3 + Math.floor(Math.random()*17)} + ${Math.floor(Math.random()*255)}) % 256;`,
    () => `            var _ = i ^ ${Math.floor(Math.random()*0xFF)};`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

function csShuf(arr) {
  const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }; return a
}

function applyEncryptionWrapper(code) {
  const m = Math.floor(Math.random() * 4)
  switch (m) {
    case 0: return csWrapperXorB64(code)
    case 1: return csWrapperHexShift(code)
    case 2: return csWrapperMultiXor(code)
    case 3: return csWrapperByteRot(code)
    default: return csWrapperXorB64(code)
  }
}

function csWrapperXorB64(code) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorData = Array.from(b64).map((c, i) => c.charCodeAt(0) ^ key[i % key.length])
  const cn = randomFuncName(), mn = randomFuncName()
  const kv = randomVarName('camelCase'), dv = randomVarName('camelCase')

  const fieldOrder = csShuf([
    `    static byte[] ${kv} = new byte[] {${key.join(', ')}};`,
    `    static byte[] ${dv} = new byte[] {${xorData.join(', ')}};`,
  ])

  return `using System;
using System.Text;

class ${cn}
{
${fieldOrder.join('\n')}

    static string ${mn}(byte[] d, byte[] k)
    {
        byte[] r = new byte[d.Length];
        for (int i = 0; i < d.Length; i++)
        {
${csLoopJunk()}
            r[i] = (byte)(d[i] ^ k[i % k.Length]);
        }
        return Encoding.ASCII.GetString(r);
    }

    static void Main()
    {
${csJunk()}
${csJunk()}
        string ${randomVarName('camelCase')} = Encoding.UTF8.GetString(
            Convert.FromBase64String(${mn}(${dv}, ${kv}))
        );
        Console.WriteLine(${randomVarName('camelCase')});
    }
}
`
}

function csWrapperHexShift(code) {
  const shift = 3 + Math.floor(Math.random() * 25)
  const hexStr = Array.from(code).map(c => ((c.charCodeAt(0) + shift) % 256).toString(16).padStart(2, '0')).join('')
  const cn = randomFuncName(), mn = randomFuncName()
  const dv = randomVarName('camelCase'), sv = randomVarName('camelCase')
  const rv = randomVarName('camelCase')

  return `using System;
using System.Text;

class ${cn}
{
    static string ${dv} = "${hexStr}";
    static int ${sv} = ${shift};

    static string ${mn}(string h, int s)
    {
        var ${rv} = new StringBuilder();
        for (int i = 0; i < h.Length; i += 2)
        {
${csLoopJunk()}
            int b = Convert.ToInt32(h.Substring(i, 2), 16);
            ${rv}.Append((char)((b - s + 256) % 256));
        }
        return ${rv}.ToString();
    }

    static void Main()
    {
${csJunk()}
        Console.WriteLine(${mn}(${dv}, ${sv}));
    }
}
`
}

function csWrapperMultiXor(code) {
  const k1 = randomXorKey(16), k2 = randomXorKey(16)
  const enc = Array.from(code).map((c, i) => (c.charCodeAt(0) ^ k1[i % k1.length]) ^ k2[i % k2.length])
  const cn = randomFuncName(), mn = randomFuncName()
  const dv = randomVarName('camelCase'), k1v = randomVarName('camelCase'), k2v = randomVarName('camelCase')
  const rv = randomVarName('camelCase')

  const fields = csShuf([
    `    static byte[] ${dv} = new byte[] {${enc.join(', ')}};`,
    `    static byte[] ${k1v} = new byte[] {${k1.join(', ')}};`,
    `    static byte[] ${k2v} = new byte[] {${k2.join(', ')}};`,
  ])

  return `using System;
using System.Text;

class ${cn}
{
${fields.join('\n')}

    static string ${mn}(byte[] d, byte[] a, byte[] b)
    {
        var ${rv} = new StringBuilder();
        for (int i = 0; i < d.Length; i++)
        {
${csLoopJunk()}
            ${rv}.Append((char)((d[i] ^ b[i % b.Length]) ^ a[i % a.Length]));
        }
        return ${rv}.ToString();
    }

    static void Main()
    {
${csJunk()}
${csJunk()}
        Console.WriteLine(${mn}(${dv}, ${k1v}, ${k2v}));
    }
}
`
}

function csWrapperByteRot(code) {
  const rotN = 3 + Math.floor(Math.random() * 50)
  const b64 = toBase64(code)
  const rot = Array.from(b64).map(c => (c.charCodeAt(0) + rotN) % 256)
  const cn = randomFuncName(), mn = randomFuncName()
  const dv = randomVarName('camelCase'), nv = randomVarName('camelCase')
  const rv = randomVarName('camelCase')

  return `using System;
using System.Text;

class ${cn}
{
    static byte[] ${dv} = new byte[] {${rot.join(', ')}};
    static int ${nv} = ${rotN};

    static string ${mn}(byte[] d, int n)
    {
        var ${rv} = new StringBuilder();
        for (int i = 0; i < d.Length; i++)
        {
${csLoopJunk()}
            ${rv}.Append((char)((d[i] - n + 256) % 256));
        }
        return ${rv}.ToString();
    }

    static void Main()
    {
${csJunk()}
        Console.WriteLine(Encoding.UTF8.GetString(
            Convert.FromBase64String(${mn}(${dv}, ${nv}))
        ));
    }
}
`
}
