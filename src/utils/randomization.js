/**
 * Randomization Utilities
 * Generates random variable names, function names, and strings
 * for payload obfuscation across multiple languages.
 */

const ALPHA_LOWER = 'abcdefghijklmnopqrstuvwxyz'
const ALPHA_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALPHA = ALPHA_LOWER + ALPHA_UPPER
const ALPHANUM = ALPHA + '0123456789'

/**
 * Generate a random string of specified length
 * @param {number} length
 * @param {string} charset
 * @returns {string}
 */
function randomString(length, charset = ALPHANUM) {
  let result = ''
  // First char must be a letter (valid identifier)
  result += ALPHA[Math.floor(Math.random() * ALPHA.length)]
  for (let i = 1; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)]
  }
  return result
}

/**
 * Generate a random variable name
 * @param {string} style - 'camelCase' | 'snake_case' | 'short' | 'ps' (PowerShell $var)
 * @returns {string}
 */
export function randomVarName(style = 'short') {
  switch (style) {
    case 'camelCase': {
      const words = ['data', 'buf', 'str', 'val', 'tmp', 'res', 'obj', 'ctx', 'cfg', 'ptr', 'ref', 'src']
      const word = words[Math.floor(Math.random() * words.length)]
      return word + randomString(3, ALPHA_UPPER + '0123456789')
    }
    case 'snake_case': {
      return randomString(2, ALPHA_LOWER) + '_' + randomString(3, ALPHA_LOWER + '0123456789')
    }
    case 'ps': {
      return '$' + randomString(5 + Math.floor(Math.random() * 4))
    }
    case 'short':
    default:
      return randomString(4 + Math.floor(Math.random() * 5))
  }
}

/**
 * Generate a random function name
 * @returns {string}
 */
export function randomFuncName() {
  const prefixes = ['Get', 'Set', 'Init', 'Load', 'Parse', 'Run', 'Check', 'Update', 'Process', 'Handle']
  const suffixes = ['Data', 'Buffer', 'Config', 'State', 'Result', 'Value', 'Object', 'Context', 'Entry', 'Item']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
  return prefix + suffix + Math.floor(Math.random() * 100)
}

/**
 * Generate a random XOR key
 * @param {number} length
 * @returns {number[]}
 */
export function randomXorKey(length = 8) {
  const key = []
  for (let i = 0; i < length; i++) {
    key.push(Math.floor(Math.random() * 256))
  }
  return key
}

/**
 * XOR encode a string with a key
 * @param {string} str
 * @param {number[]} key
 * @returns {number[]}
 */
export function xorEncode(str, key) {
  const result = []
  for (let i = 0; i < str.length; i++) {
    result.push(str.charCodeAt(i) ^ key[i % key.length])
  }
  return result
}

/**
 * Generate a random comment (for dead code injection)
 * @returns {string}
 */
export function randomComment() {
  const comments = [
    'Initialize configuration parameters',
    'Check environment state',
    'Validate input buffer',
    'Process data transformation',
    'Update internal state machine',
    'Handle edge case for legacy systems',
    'Prepare output formatting',
    'Cleanup temporary resources',
    'Verify checksum integrity',
    'Apply normalization rules',
  ]
  return comments[Math.floor(Math.random() * comments.length)]
}

/**
 * Generate random dead code snippets per language
 * @param {string} language
 * @returns {string}
 */
export function generateDeadCode(language) {
  const varName = randomVarName('short')
  const num = Math.floor(Math.random() * 1000)

  switch (language) {
    case 'powershell': {
      const snippets = [
        `$${varName} = ${num}; if ($${varName} -gt ${num + 1}) { Write-Host "unreachable" }`,
        `$${varName} = [System.DateTime]::Now.Millisecond; $${varName} = $null`,
        `try { $${varName} = ${num} * 2 } catch { }`,
        `[void]($${varName} = @(${num}, ${num + 1}, ${num + 2}) | Sort-Object)`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'python': {
      const snippets = [
        `${varName} = ${num}; ${varName} = ${varName} if ${varName} > ${num + 1} else ${num}`,
        `${varName} = list(range(${num % 10})); del ${varName}`,
        `${varName} = lambda x: x * ${num}; _ = ${varName}(0)`,
        `try:\n    ${varName} = ${num} ** 2\nexcept:\n    pass`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'bash': {
      const snippets = [
        `${varName}=${num}; [ $${varName} -gt ${num + 1} ] && echo "" > /dev/null`,
        `${varName}=$(date +%s); unset ${varName}`,
        `${varName}=$((${num} * 2)); ${varName}=0`,
        `for ${varName} in $(seq 1 1); do : ; done`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'csharp': {
      const snippets = [
        `int ${varName} = ${num}; if (${varName} > ${num + 1}) { Console.Write(""); }`,
        `var ${varName} = new byte[${num % 16}]; Array.Clear(${varName}, 0, ${varName}.Length);`,
        `string ${varName} = "${num}"; ${varName} = null;`,
        `try { int ${varName} = ${num} / 1; } catch { }`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'go': {
      const snippets = [
        `${varName} := ${num}; _ = ${varName}`,
        `${varName} := make([]byte, ${num % 16}); _ = len(${varName})`,
        `${varName} := fmt.Sprintf("%d", ${num}); _ = ${varName}`,
        `if ${num} > ${num + 1} { _ = ${num} }`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    default:
      return `// ${randomComment()}`
  }
}
