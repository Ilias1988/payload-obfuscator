/**
 * Shannon Entropy Calculator
 * Measures the randomness/information density of a string.
 * Used to estimate how "suspicious" obfuscated code looks to AV/EDR.
 *
 * Scale: 0 (uniform) → ~4.5 (normal code) → 6+ (encoded/encrypted)
 * Values > 6.5 are often flagged as packed/encrypted malware.
 */

/**
 * Calculate Shannon entropy of a string
 * @param {string} str - Input string
 * @returns {number} Entropy value (0-8 for ASCII)
 */
export function calculateEntropy(str) {
  if (!str || str.length === 0) return 0

  const freq = {}
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    freq[char] = (freq[char] || 0) + 1
  }

  const len = str.length
  let entropy = 0

  for (const char in freq) {
    const p = freq[char] / len
    if (p > 0) {
      entropy -= p * Math.log2(p)
    }
  }

  return Math.round(entropy * 1000) / 1000
}

/**
 * Get entropy classification label and color
 * @param {number} entropy - Shannon entropy value
 * @returns {{ label: string, color: string, risk: string, percentage: number }}
 */
export function getEntropyClassification(entropy) {
  const percentage = Math.min((entropy / 8) * 100, 100)

  if (entropy < 3.5) {
    return {
      label: 'Low',
      color: '#10b981', // green
      risk: 'Minimal detection risk — code appears natural',
      percentage,
    }
  }
  if (entropy < 4.5) {
    return {
      label: 'Normal',
      color: '#06b6d4', // cyan
      risk: 'Normal code entropy — unlikely to trigger alerts',
      percentage,
    }
  }
  if (entropy < 5.5) {
    return {
      label: 'Moderate',
      color: '#f59e0b', // amber
      risk: 'Moderate entropy — some heuristic engines may inspect further',
      percentage,
    }
  }
  if (entropy < 6.5) {
    return {
      label: 'High',
      color: '#f97316', // orange
      risk: 'High entropy — resembles encoded/compressed data',
      percentage,
    }
  }
  return {
    label: 'Very High',
    color: '#ef4444', // red
    risk: 'Very high entropy — likely flagged as packed/encrypted malware',
    percentage,
  }
}

/**
 * Calculate a rough detection score based on various heuristics
 * @param {string} original - Original code
 * @param {string} obfuscated - Obfuscated code
 * @param {string} language - Language identifier
 * @param {string[]} activeLayers - Active obfuscation layers
 * @returns {{ score: number, breakdown: Array<{name: string, impact: number, description: string}> }}
 */
export function calculateDetectionScore(original, obfuscated, language, activeLayers = []) {
  if (!obfuscated || obfuscated.length === 0) {
    return { score: 100, breakdown: [] }
  }

  let score = 100 // Start at 100% detectable, reduce with each layer
  const breakdown = []

  // 1. Variable randomization impact
  if (activeLayers.includes('randomize')) {
    const impact = -20
    score += impact
    breakdown.push({
      name: 'Variable Randomization',
      impact,
      description: 'Breaks static signature matching on known variable names',
    })
  }

  // 2. String encoding impact
  if (activeLayers.includes('encode')) {
    const impact = -25
    score += impact
    breakdown.push({
      name: 'String Encoding',
      impact,
      description: 'Hides suspicious string literals from pattern scanners',
    })
  }

  // 3. Dead code injection
  if (activeLayers.includes('deadcode')) {
    const impact = -10
    score += impact
    breakdown.push({
      name: 'Dead Code Injection',
      impact,
      description: 'Alters control flow graph, confuses static analysis',
    })
  }

  // 4. Anti-analysis techniques
  if (activeLayers.includes('antianalysis')) {
    const impact = -15
    score += impact
    breakdown.push({
      name: 'Anti-Analysis',
      impact,
      description: 'Sandbox detection and timing evasion techniques',
    })
  }

  // 5. Encryption wrapper
  if (activeLayers.includes('encrypt')) {
    const impact = -20
    score += impact
    breakdown.push({
      name: 'Encryption Wrapper',
      impact,
      description: 'AES/XOR envelope hides entire payload structure',
    })
  }

  // 6. Entropy penalty — high entropy increases detection
  const entropy = calculateEntropy(obfuscated)
  if (entropy > 6.0) {
    const penalty = Math.min(Math.round((entropy - 6.0) * 8), 15)
    score += penalty
    breakdown.push({
      name: 'High Entropy Penalty',
      impact: penalty,
      description: `Entropy of ${entropy.toFixed(2)} may trigger heuristic detection`,
    })
  }

  // 7. Size ratio consideration
  const sizeRatio = obfuscated.length / Math.max(original.length, 1)
  if (sizeRatio > 5) {
    const penalty = Math.min(Math.round((sizeRatio - 5) * 3), 10)
    score += penalty
    breakdown.push({
      name: 'Size Inflation Penalty',
      impact: penalty,
      description: `${sizeRatio.toFixed(1)}x size increase may look suspicious`,
    })
  }

  return {
    score: Math.max(Math.min(score, 100), 5),
    breakdown,
  }
}
