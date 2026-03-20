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
