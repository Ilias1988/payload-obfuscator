/**
 * C# Obfuscation Engine
 * Techniques: String.Concat, char arrays, XOR encryption,
 * reflection-based invocation, dead code, encryption wrapper.
 */

import { toBase64 } from '../utils/encoding'
import { randomVarName, randomFuncName, generateDeadCode, randomXorKey } from '../utils/randomization'

export function obfuscateCSharp(code, layers = []) {
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

function applyVariableRandomization(code) {
  const varPattern = /\b(?:var|int|string|byte\[\]|bool|double|float|long|char|object|Stream|StreamReader|StreamWriter|TcpClient|Process|IntPtr)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
  const reserved = new Set([
    'Main', 'args', 'Console', 'System', 'String', 'Math', 'Array',
    'Environment', 'Process', 'Thread', 'Marshal', 'IntPtr', 'Zero',
  ])

  const varMap = {}
  let match
  while ((match = varPattern.exec(code)) !== null) {
    const varName = match[1]
    if (!reserved.has(varName) && !varMap[varName]) {
      varMap[varName] = randomVarName('camelCase')
    }
  }

  let result = code
  const sortedVars = Object.keys(varMap).sort((a, b) => b.length - a.length)
  for (const varName of sortedVars) {
    const regex = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
    result = result.replace(regex, varMap[varName])
  }

  return result
}

function applyStringEncoding(code) {
  const stringPattern = /"([^"]{3,})"/g

  return code.replace(stringPattern, (match, content) => {
    const method = Math.floor(Math.random() * 3)

    switch (method) {
      case 0: {
        // String.Concat with char casts
        const chars = Array.from(content)
          .map((c) => `(char)${c.charCodeAt(0)}`)
          .join(', ')
        return `new string(new char[] {${chars}})`
      }
      case 1: {
        // Byte array to string
        const bytes = Array.from(content)
          .map((c) => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(', ')
        return `System.Text.Encoding.ASCII.GetString(new byte[] {${bytes}})`
      }
      case 2: {
        // String.Concat with substrings
        const chunkSize = Math.max(2, Math.ceil(content.length / 4))
        const parts = []
        for (let i = 0; i < content.length; i += chunkSize) {
          parts.push(`"${content.substring(i, i + chunkSize)}"`)
        }
        return `string.Concat(${parts.join(', ')})`
      }
      default:
        return match
    }
  })
}

function applyDeadCodeInjection(code) {
  const lines = code.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i])
    if (i > 0 && i % (4 + Math.floor(Math.random() * 3)) === 0 && lines[i].trim() !== '{' && lines[i].trim() !== '}') {
      result.push('        ' + generateDeadCode('csharp'))
    }
  }

  return result.join('\n')
}

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

  // Insert after first '{' in Main
  const mainIndex = code.indexOf('static void Main')
  if (mainIndex !== -1) {
    const braceIndex = code.indexOf('{', mainIndex)
    if (braceIndex !== -1) {
      return code.substring(0, braceIndex + 1) + '\n' + antiAnalysis + '\n' + code.substring(braceIndex + 1)
    }
  }

  return '// Anti-analysis\n' + antiAnalysis + '\n' + code
}

function applyEncryptionWrapper(code) {
  const key = randomXorKey(16)
  const b64 = toBase64(code)
  const xorEncoded = Array.from(b64)
    .map((c, i) => c.charCodeAt(0) ^ key[i % key.length])

  const className = randomFuncName()
  const methodName = randomFuncName()
  const keyVar = randomVarName('camelCase')
  const dataVar = randomVarName('camelCase')

  return `using System;
using System.Reflection;
using System.Text;

class ${className} {
    static byte[] ${keyVar} = new byte[] {${key.join(', ')}};
    static byte[] ${dataVar} = new byte[] {${xorEncoded.join(', ')}};

    static string ${methodName}(byte[] d, byte[] k) {
        byte[] r = new byte[d.Length];
        for (int i = 0; i < d.Length; i++)
            r[i] = (byte)(d[i] ^ k[i % k.Length]);
        return Encoding.ASCII.GetString(r);
    }

    static void Main() {
        string decoded = Encoding.UTF8.GetString(
            Convert.FromBase64String(${methodName}(${dataVar}, ${keyVar}))
        );
        // Runtime compilation/execution would go here
        Console.WriteLine("// Decrypted payload ready for compilation");
        Console.WriteLine(decoded);
    }
}
`
}
