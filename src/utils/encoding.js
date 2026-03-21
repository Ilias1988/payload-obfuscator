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
 * XOR encrypt a string and return language-specific inline decryption code.
 * The decrypt function is injected ONCE per output (tracked by caller).
 *
 * @param {string} str - plaintext string
 * @param {string} language - target language
 * @param {string} [decryptFuncName] - name of the decrypt helper
 * @returns {{ inline: string, needsHelper: boolean, helper: string }}
 */
export function xorEncryptForLanguage(str, language, decryptFuncName = '_xd') {
  const key = generateXorKey()
  const encrypted = xorEncodeString(str, key)

  switch (language) {
    case 'powershell': {
      const dataArr = encrypted.join(',')
      const keyArr = key.join(',')
      return {
        inline: `(${decryptFuncName} @(${dataArr}) @(${keyArr}))`,
        needsHelper: true,
        helper: `function ${decryptFuncName}($d,$k){$r=@();for($i=0;$i-lt$d.Length;$i++){$r+=[byte]($d[$i]-bxor$k[$i%$k.Length])};[System.Text.Encoding]::UTF8.GetString([byte[]]$r)}`,
      }
    }
    case 'python': {
      const dataArr = encrypted.join(',')
      const keyArr = key.join(',')
      return {
        inline: `${decryptFuncName}([${dataArr}],[${keyArr}])`,
        needsHelper: true,
        helper: `${decryptFuncName}=lambda d,k:''.join(chr(d[i]^k[i%len(k)])for i in range(len(d)))`,
      }
    }
    case 'bash': {
      // Bash XOR via printf + awk
      const hexData = encrypted.map(b => b.toString(16).padStart(2, '0')).join(' ')
      const hexKey = key.map(b => b.toString(16).padStart(2, '0')).join(' ')
      return {
        inline: `$(${decryptFuncName} "${hexData}" "${hexKey}")`,
        needsHelper: true,
        helper: `${decryptFuncName}(){ local d=($1) k=($2) r=""; for((i=0;i<\${#d[@]};i++)); do r+=$(printf "\\\\x$(printf '%02x' $((0x\${d[$i]}^0x\${k[$((i%\${#k[@]}))]})))"); done; printf "$r"; }`,
      }
    }
    case 'csharp': {
      const dataArr = encrypted.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      const keyArr = key.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      return {
        inline: `${decryptFuncName}(new byte[]{${dataArr}},new byte[]{${keyArr}})`,
        needsHelper: true,
        helper: `static string ${decryptFuncName}(byte[]d,byte[]k){var r=new byte[d.Length];for(int i=0;i<d.Length;i++)r[i]=(byte)(d[i]^k[i%k.Length]);return System.Text.Encoding.UTF8.GetString(r);}`,
      }
    }
    case 'go': {
      const dataArr = encrypted.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      const keyArr = key.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(',')
      return {
        inline: `${decryptFuncName}([]byte{${dataArr}},[]byte{${keyArr}})`,
        needsHelper: true,
        helper: `func ${decryptFuncName}(d,k[]byte)string{r:=make([]byte,len(d));for i:=range d{r[i]=d[i]^k[i%len(k)]};return string(r)}`,
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
