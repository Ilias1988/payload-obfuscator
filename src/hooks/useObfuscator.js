import { useState, useCallback, useMemo } from 'react'
import { obfuscatePowerShell } from '../engines/powershell'
import { obfuscatePython } from '../engines/python'
import { obfuscateBash } from '../engines/bash'
import { obfuscateCSharp } from '../engines/csharp'
import { obfuscateGo } from '../engines/golang'
import { calculateEntropy, getEntropyClassification, calculateDetectionScore } from '../utils/entropy'

const ENGINE_MAP = {
  powershell: obfuscatePowerShell,
  python: obfuscatePython,
  bash: obfuscateBash,
  csharp: obfuscateCSharp,
  go: obfuscateGo,
}

export default function useObfuscator() {
  const [language, setLanguage] = useState('powershell')
  const [inputCode, setInputCode] = useState('')
  const [outputCode, setOutputCode] = useState('')
  const [activeLayers, setActiveLayers] = useState([])

  const toggleLayer = useCallback((layerId) => {
    setActiveLayers((prev) =>
      prev.includes(layerId) ? prev.filter((l) => l !== layerId) : [...prev, layerId]
    )
  }, [])

  const obfuscate = useCallback(() => {
    const engine = ENGINE_MAP[language]
    if (!engine || !inputCode.trim()) {
      setOutputCode('')
      return
    }
    const result = engine(inputCode, activeLayers)
    setOutputCode(result)
  }, [language, inputCode, activeLayers])

  const analysis = useMemo(() => {
    if (!outputCode) {
      return {
        inputEntropy: calculateEntropy(inputCode),
        inputEntropyClass: getEntropyClassification(calculateEntropy(inputCode)),
        outputEntropy: 0,
        outputEntropyClass: getEntropyClassification(0),
        detectionScore: { score: 100, breakdown: [] },
        inputSize: inputCode.length,
        outputSize: 0,
        sizeRatio: 0,
      }
    }

    const inputEntropy = calculateEntropy(inputCode)
    const outputEntropy = calculateEntropy(outputCode)
    const detectionScore = calculateDetectionScore(inputCode, outputCode, language, activeLayers)

    return {
      inputEntropy,
      inputEntropyClass: getEntropyClassification(inputEntropy),
      outputEntropy,
      outputEntropyClass: getEntropyClassification(outputEntropy),
      detectionScore,
      inputSize: inputCode.length,
      outputSize: outputCode.length,
      sizeRatio: inputCode.length > 0 ? (outputCode.length / inputCode.length).toFixed(1) : 0,
    }
  }, [inputCode, outputCode, language, activeLayers])

  const clearAll = useCallback(() => {
    setInputCode('')
    setOutputCode('')
  }, [])

  return {
    language,
    setLanguage,
    inputCode,
    setInputCode,
    outputCode,
    setOutputCode,
    activeLayers,
    toggleLayer,
    setActiveLayers,
    obfuscate,
    analysis,
    clearAll,
  }
}
