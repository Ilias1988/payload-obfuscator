import { Code, Download, AlertTriangle, ShieldCheck } from 'lucide-react'
import CopyButton from '../ui/CopyButton'
import { LANGUAGES } from '../../data/techniques'

export default function OutputPanel({ language, outputCode, warnings = [], stealthActive = false }) {
  const langData = LANGUAGES.find((l) => l.id === language)

  const handleDownload = () => {
    if (!outputCode) return
    const blob = new Blob([outputCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `obfuscated${langData?.extension || '.txt'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="terminal-header flex items-center justify-between px-3 py-2 border-b border-dark-700/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="terminal-dot bg-obf-red/80" />
            <span className="terminal-dot bg-obf-amber/80" />
            <span className="terminal-dot bg-obf-green/80" />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <Code size={13} className="text-obf-red" />
            <span className="text-xs text-dark-400 font-medium">
              Obfuscated Output
            </span>
          </div>
          {stealthActive && (
            <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-obf-green/10 border border-obf-green/30 rounded animate-pulse">
              <ShieldCheck size={10} className="text-obf-green" />
              <span className="text-[9px] text-obf-green font-semibold tracking-wide">STEALTH</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <CopyButton text={outputCode} />
          <button
            onClick={handleDownload}
            disabled={!outputCode}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-dark-400 hover:text-gray-200 bg-dark-700/30 hover:bg-dark-700/60 border border-dark-600/30 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Download"
          >
            <Download size={11} />
          </button>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 relative overflow-hidden rounded-b-lg">
        {outputCode ? (
          <pre className="w-full h-full min-h-[280px] lg:min-h-[400px] p-4 bg-dark-900 text-obf-green font-mono text-sm leading-relaxed overflow-auto whitespace-pre-wrap break-all">
            {outputCode}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[280px] lg:min-h-[400px] bg-dark-900">
            <div className="text-center space-y-2">
              <Code size={32} className="mx-auto text-dark-700" />
              <p className="text-dark-600 text-sm">Obfuscated output will appear here</p>
              <p className="text-dark-700 text-xs">Select layers and click Obfuscate</p>
            </div>
          </div>
        )}
        {/* Stats */}
        {outputCode && (
          <div className="absolute bottom-2 right-3 text-[10px] text-dark-600 font-mono">
            {outputCode.split('\n').length} lines · {outputCode.length} chars
          </div>
        )}
      </div>

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="border-t border-obf-amber/20 bg-obf-amber/5 px-3 py-2 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-obf-amber">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
