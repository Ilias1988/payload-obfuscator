/**
 * Encoding Utilities
 * Base64, Hex, XOR, and other encoding functions
 * used across all obfuscation engines.
 */

/**
 * Encode string to Base64
 * @param {string} str
 * @returns {string}
 */
export function toBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    return btoa(str)
  }
}

/**
 * Encode string to Hex
 * @param {string} str
 * @returns {string}
 */
export function toHex(str) {
  return Array.from(str)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert string to char code array
 * @param {string} str
 * @returns {number[]}
 */
export function toCharCodes(str) {
  return Array.from(str).map((c) => c.charCodeAt(0))
}

/**
 * XOR encode string with a key byte array
 * @param {string} str
 * @param {number[]} key
 * @returns {number[]}
 */
export function xorEncodeString(str, key) {
  return Array.from(str).map((c, i) => c.charCodeAt(0) ^ key[i % key.length])
}

/**
 * Generate a random XOR key (4-8 bytes)
 * @param {number} [len] - key length (default: random 4-8)
 * @returns {number[]}
 */
export function generateXorKey(len) {
  const keyLen = len || (4 + Math.floor(Math.random() * 5))
  return Array.from({ length: keyLen }, () => 1 + Math.floor(Math.random() * 254))
}

/**
 * Resolve language-specific escape sequences to real characters.
 * Called BEFORE encoding string content (Base64/Hex/XOR) so that
 * control characters like \n and \t are preserved as actual bytes.
 *
 * @param {string} content - Raw string content from tokenizer
 * @param {string} language - Target language
 * @returns {string} Content with escape sequences resolved
 */
export function resolveLanguageEscapes(content, language) {
  if (!content) return content

  // Common C-style escapes (Python, C#, Go, Bash)
  const C_ESCAPES = {
    '\\n': '\n', '\\t': '\t', '\\r': '\r', '\\0': '\0',
    '\\a': '\x07', '\\b': '\x08', '\\f': '\x0C', '\\v': '\x0B',
    '\\\\': '\\', '\\"': '"', "\\'": "'",
  }

  // PowerShell uses backtick escapes
  const PS_ESCAPES = {
    n: '\n', r: '\r', t: '\t', a: '\x07', b: '\x08',
    f: '\x0C', v: '\x0B', 0: '\0', e: '\x1B',
    '`': '`', '"': '"', '$': '$',
  }

  if (language === 'powershell') {
    let resolved = ''
    for (let i = 0; i < content.length; i++) {
      if (content[i] !== '`' || i + 1 >= content.length) {
        resolved += content[i]
        continue
      }

      const escaped = content[i + 1]
      if (Object.prototype.hasOwnProperty.call(PS_ESCAPES, escaped)) {
        resolved += PS_ESCAPES[escaped]
        i++
      } else if (escaped === '\r' && content[i + 2] === '\n') {
        i += 2
      } else if (escaped === '\n') {
        i++
      } else {
        // Unknown PowerShell escape: preserve it exactly.
        resolved += '`' + escaped
        i++
      }
    }
    return resolved
  }

  if (language === 'csharp') {
    const simpleEscapes = {
      "'": "'", '"': '"', '\\': '\\', 0: '\0', a: '\x07', b: '\x08',
      f: '\x0C', n: '\n', r: '\r', t: '\t', v: '\x0B',
    }
    let resolved = ''
    for (let i = 0; i < content.length; i++) {
      if (content[i] !== '\\' || i + 1 >= content.length) {
        resolved += content[i]
        continue
      }

      const kind = content[i + 1]
      if (Object.prototype.hasOwnProperty.call(simpleEscapes, kind)) {
        resolved += simpleEscapes[kind]
        i++
        continue
      }

      const maxDigits = kind === 'u' ? 4 : kind === 'U' ? 8 : kind === 'x' ? 4 : 0
      const minDigits = kind === 'x' ? 1 : maxDigits
      if (maxDigits > 0) {
        const candidate = content.slice(i + 2, i + 2 + maxDigits)
        const match = new RegExp(`^[0-9a-fA-F]{${minDigits},${maxDigits}}`).exec(candidate)
        if (match && (kind === 'x' || match[0].length === maxDigits)) {
          const codePoint = Number.parseInt(match[0], 16)
          if (codePoint <= 0x10FFFF) {
            resolved += String.fromCodePoint(codePoint)
            i += 1 + match[0].length
            continue
          }
        }
      }

      // Preserve invalid/unknown escapes so malformed input is not silently
      // changed into a different program.
      resolved += '\\' + kind
      i++
    }
    return resolved
  }

  const escapeMap = C_ESCAPES
  let resolved = content

  for (const [esc, real] of Object.entries(escapeMap)) {
    resolved = resolved.replaceAll(esc, real)
  }

  return resolved
}

/**
 * XOR encrypt a string and return language-specific inline decryption code.
 * The decrypt function is injected ONCE per output (tracked by caller).
 *
 * @param {string} str - plaintext string
 * @param {string} language - target language
 * @param {string} [decryptFuncName] - name of the decrypt helper
 * @returns {{ inline: string, needsHelper: boolean, helper: string }}
 */
export function xorEncryptForLanguage(str, language, decryptFuncName = '_xd') {
  // Resolve escape sequences to real chars before encoding
  const resolved = resolveLanguageEscapes(str, language)

  switch (language) {
    case 'powershell': {
      // B64-first: encode resolved string to Base64 (ASCII-safe), then XOR the B64 bytes
      // This prevents Unicode chars (>255) from breaking the [byte] cast
      const b64 = toBase64(resolved)
      const b64Key = generateXorKey()
      const b64Encrypted = xorEncodeString(b64, b64Key)
      const dataArr = b64Encrypted.join(',')
      const keyArr = b64Key.join(',')
      return {
        inline: `(${decryptFuncName} @(${dataArr}) @(${keyArr}))`,
        needsHelper: true,
        // Decrypt stub: XOR → reconstruct B64 string → FromBase64String → UTF8.GetString
        helper: `function ${decryptFuncName}($d,$k){$b="";for($i=0;$i-lt$d.Length;$i++){$b+=[char]($d[$i]-bxor$k[$i%$k.Length])};[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))}`,
      }
    }
    case 'python': {
      // B64-first for Python too: safe for any Unicode input
      const b64 = toBase64(resolved)
      const b64Key = generateXorKey()
      const b64Encrypted = xorEncodeString(b64, b64Key)
      const dataArr = b64Encrypted.join(',')
      const keyArr = b64Key.join(',')
      return {
        inline: `${decryptFuncName}([${dataArr}],[${keyArr}])`,
        needsHelper: true,
        helper: `${decryptFuncName}=lambda d,k:__import__('base64').b64decode(''.join(chr(d[i]^k[i%len(k)])for i in range(len(d)))).decode()`,
      }
    }
    case 'bash': {
      // B64-first: encode resolved string to Base64 (ASCII-safe), then XOR the B64 bytes
      const b64 = toBase64(resolved)
      const b64Key = generateXorKey()
      const b64Encrypted = xorEncodeString(b64, b64Key)
      const hexData = b64Encrypted.map(b => b.toString(16).padStart(2, '0')).join(' ')
      const hexKey = b64Key.map(b => b.toString(16).padStart(2, '0')).join(' ')
      return {
        inline: `$(${decryptFuncName} "${hexData}" "${hexKey}")`,
        needsHelper: true,
        // Decrypt stub: XOR → reconstruct B64 string → base64 -d
        helper: `${decryptFuncName}(){ local d=($1) k=($2) r=""; for((i=0;i<\${#d[@]};i++)); do r+=$(printf "\\\\x$(printf '%02x' $((0x\${d[$i]}^0x\${k[$((i%\${#k[@]}))]})))"); done; echo "$r" | base64 -d; }`,
      }
    }
    case 'csharp': {
      // B64-first: encode resolved string to Base64 (ASCII-safe), then XOR the B64 bytes
      const b64 = toBase64(resolved)
      const b64Key = generateXorKey()
      const b64Encrypted = xorEncodeString(b64, b64Key)
      const dataArr = b64Encrypted.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      const keyArr = b64Key.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      return {
        inline: `${decryptFuncName}(new byte[]{${dataArr}},new byte[]{${keyArr}})`,
        needsHelper: true,
        helper: `static string ${decryptFuncName}(byte[]d,byte[]k){var r=new byte[d.Length];for(int i=0;i<d.Length;i++)r[i]=(byte)(d[i]^k[i%k.Length]);return System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(System.Text.Encoding.ASCII.GetString(r)));}`,
      }
    }
    case 'go': {
      // B64-first: encode resolved string to Base64 (ASCII-safe), then XOR the B64 bytes
      const b64 = toBase64(resolved)
      const b64Key = generateXorKey()
      const b64Encrypted = xorEncodeString(b64, b64Key)
      const dataArr = b64Encrypted.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      const keyArr = b64Key.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      return {
        inline: `${decryptFuncName}([]byte{${dataArr}},[]byte{${keyArr}})`,
        needsHelper: true,
        helper: `func ${decryptFuncName}(d,k[]byte)string{r:=make([]byte,len(d));for i:=range d{r[i]=d[i]^k[i%len(k)]};b,_:=base64.StdEncoding.DecodeString(string(r));return string(b)}`,
      }
    }
    default:
      return { inline: `"${str}"`, needsHelper: false, helper: '' }
  }
}

/**
 * Reverse a string
 * @param {string} str
 * @returns {string}
 */
export function reverseString(str) {
  return str.split('').reverse().join('')
}

/**
 * Split string into chunks
 * @param {string} str
 * @param {number} size
 * @returns {string[]}
 */
export function chunkString(str, size) {
  const chunks = []
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size))
  }
  return chunks
}

/**
 * Generate a random AES-like key (for display purposes)
 * @param {number} length
 * @returns {string}
 */
export function generateAesKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let key = ''
  for (let i = 0; i < length; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}
