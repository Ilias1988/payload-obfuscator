/**
 * Shannon Entropy Calculator
 * Measures the randomness/information density of a string.
 * Used to compare the information density of input and transformed output.
 *
 * Scale: 0 (uniform) → ~4.5 (normal code) → 6+ (encoded/encrypted)
 * Entropy alone cannot determine whether code is safe, malicious, or detectable.
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
      risk: 'Low information density for this text sample',
      percentage,
    }
  }
  if (entropy < 4.5) {
    return {
      label: 'Normal',
      color: '#06b6d4', // cyan
      risk: 'Typical information density for many text and source samples',
      percentage,
    }
  }
  if (entropy < 5.5) {
    return {
      label: 'Moderate',
      color: '#f59e0b', // amber
      risk: 'Moderate information density; compare with the original source',
      percentage,
    }
  }
  if (entropy < 6.5) {
    return {
      label: 'High',
      color: '#f97316', // orange
      risk: 'High information density, often associated with encoded or compressed data',
      percentage,
    }
  }
  return {
    label: 'Very High',
    color: '#ef4444', // red
    risk: 'Very high information density; this metric alone is not a scanner result',
    percentage,
  }
}

/**
 * Calculate a relative exposure estimate from configured layer weights.
 * This is an explanatory UI metric, not a security scanner prediction.
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

  let score = 100 // Baseline for the relative layer-weight model.
  const breakdown = []

  // 1. Variable randomization impact
  if (activeLayers.includes('randomize')) {
    const impact = -20
    score += impact
    breakdown.push({
      name: 'Variable Randomization',
      impact,
      description: 'Changes recognized identifier patterns',
    })
  }

  // 2. String encoding impact
  if (activeLayers.includes('encode')) {
    const impact = -25
    score += impact
    breakdown.push({
      name: 'String Encoding',
      impact,
      description: 'Changes compatible string-literal representation',
    })
  }

  // 3. Dead code injection
  if (activeLayers.includes('deadcode')) {
    const impact = -10
    score += impact
    breakdown.push({
      name: 'Dead Code Injection',
      impact,
      description: 'Adds non-functional statements at guarded locations',
    })
  }

  // 4. Anti-analysis techniques
  if (activeLayers.includes('antianalysis')) {
    const impact = -15
    score += impact
    breakdown.push({
      name: 'Anti-Analysis',
      impact,
      description: 'Adds environment-dependent timing and host checks',
    })
  }

  // 5. Encryption wrapper
  if (activeLayers.includes('encrypt')) {
    const impact = -20
    score += impact
    breakdown.push({
      name: 'Encryption Wrapper',
      impact,
      description: 'Adds a runtime wrapper and changes visible source structure',
    })
  }

  // 5b. XOR String Encryption
  if (activeLayers.includes('xorstrings')) {
    const impact = -15
    score += impact
    breakdown.push({
      name: 'XOR String Encryption',
      impact,
      description: 'Reconstructs compatible string literals at runtime',
    })
  }

  // 5c. Control Flow Flattening
  if (activeLayers.includes('controlflow')) {
    const impact = -10
    score += impact
    breakdown.push({
      name: 'Control Flow Flattening',
      impact,
      description: 'Restructures supported code with a state-machine pattern',
    })
  }

  // 5d. AMSI/ETW Memory Patch
  if (activeLayers.includes('amsietw')) {
    const impact = -15
    score += impact
    breakdown.push({
      name: 'AMSI/ETW Memory Patch',
      impact,
      description: 'Adds a security-sensitive Windows-only lab patch',
    })
  }

  // 6. Entropy adjustment in the relative model.
  const entropy = calculateEntropy(obfuscated)
  if (entropy > 6.0) {
    const penalty = Math.min(Math.round((entropy - 6.0) * 8), 15)
    score += penalty
    breakdown.push({
      name: 'High Entropy Penalty',
      impact: penalty,
      description: `Entropy is ${entropy.toFixed(2)}; compare this with the original source`,
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
      description: `${sizeRatio.toFixed(1)}x increase adds runtime and review complexity`,
    })
  }

  return {
    score: Math.max(Math.min(score, 100), 5),
    breakdown,
  }
}
