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
        `if ($null -ne $true) { $${varName} = Get-Date }`,
        `$${varName} = [Environment]::MachineName.Length; $${varName} = $null`,
        `$${varName} = (Get-Random -Minimum 1 -Maximum ${num + 100}); [void]$${varName}`,
        `$${varName} = [System.Diagnostics.Process]::GetCurrentProcess().Id`,
        `try { $${varName} = [System.IO.Path]::GetTempPath() } catch { $${varName} = $null }`,
        `$${varName} = @{}; $${varName}["ts"] = [DateTime]::UtcNow.Ticks`,
        `$${varName} = [System.Net.Dns]::GetHostName().Length`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'python': {
      const snippets = [
        `_${varName} = __import__("time").time()`,
        `_${varName} = {"timeout": ${num % 60}, "retries": ${(num % 5) + 1}}`,
        `_${varName} = __import__("os").getpid()`,
        `_${varName} = len(__import__("sys").argv) if hasattr(__import__("sys"), "argv") else 0`,
        `_${varName} = __import__("hashlib").md5(b"${num}").hexdigest()[:8]`,
        `_${varName} = [x for x in range(${num % 10})]`,
        `try:\n    _${varName} = __import__("os").path.exists("/tmp")\nexcept Exception:\n    pass`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'bash': {
      const snippets = [
        `_${varName}=$(date +%s%N); : "$_${varName}"`,
        `_${varName}=$$; _${varName}=$PPID`,
        `_${varName}=$(uname -r 2>/dev/null); unset _${varName}`,
        `_${varName}=$(cat /proc/uptime 2>/dev/null | cut -d' ' -f1)`,
        `_${varName}=$((RANDOM % ${num + 1})); : "$_${varName}"`,
        `read -t 0.01 _${varName} < /dev/null 2>/dev/null || true`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'csharp': {
      const snippets = [
        `var ${varName} = DateTime.UtcNow.Ticks; _ = ${varName};`,
        `var ${varName} = Environment.ProcessorCount; _ = ${varName};`,
        `var ${varName} = System.IO.Path.GetTempPath(); _ = ${varName}.Length;`,
        `GC.Collect(0, GCCollectionMode.Optimized);`,
        `var ${varName} = System.Diagnostics.Process.GetCurrentProcess().Id; _ = ${varName};`,
        `var ${varName} = new System.Random().Next(1, ${num + 100}); _ = ${varName};`,
        `System.Threading.Thread.Yield();`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    case 'go': {
      const snippets = [
        `${varName} := time.Now().UnixNano(); _ = ${varName}`,
        `${varName} := runtime.NumGoroutine(); _ = ${varName}`,
        `${varName} := os.Getpid(); _ = ${varName}`,
        `${varName} := make([]byte, ${(num % 16) + 1}); _ = len(${varName})`,
        `runtime.Gosched()`,
        `${varName} := fmt.Sprintf("%d", time.Now().Unix()); _ = ${varName}`,
      ]
      return snippets[Math.floor(Math.random() * snippets.length)]
    }
    default:
      return `// ${randomComment()}`
  }
}
