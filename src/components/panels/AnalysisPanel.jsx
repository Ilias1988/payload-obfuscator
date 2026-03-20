import { BarChart3, ShieldAlert, HardDrive, ArrowUpDown, TrendingDown } from 'lucide-react'
import EntropyMeter from '../ui/EntropyMeter'

export default function AnalysisPanel({ analysis }) {
  const { detectionScore } = analysis
  const hasOutput = analysis.outputSize > 0

  // Detection score color
  const getScoreColor = (score) => {
    if (score <= 20) return '#10b981' // green - very low detection
    if (score <= 40) return '#06b6d4' // cyan
    if (score <= 60) return '#f59e0b' // amber
    if (score <= 80) return '#f97316' // orange
    return '#ef4444' // red - high detection
  }

  const scoreColor = getScoreColor(detectionScore.score)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={15} className="text-obf-cyan" />
        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
          Analysis
        </span>
      </div>

      {/* Detection Score */}
      <div className="p-3 bg-dark-800/40 border border-dark-700/30 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-400 flex items-center gap-1">
            <ShieldAlert size={12} />
            Detection Probability
          </span>
          <span
            className="text-lg font-bold font-mono"
            style={{ color: scoreColor }}
          >
            {hasOutput ? `${detectionScore.score}%` : '—'}
          </span>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: hasOutput ? `${detectionScore.score}%` : '0%',
              backgroundColor: scoreColor,
              boxShadow: `0 0 8px ${scoreColor}40`,
            }}
          />
        </div>

        {/* Breakdown */}
        {hasOutput && detectionScore.breakdown.length > 0 && (
          <div className="space-y-1 pt-1">
            {detectionScore.breakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px]">
                <span className="text-dark-500 truncate mr-2">{item.name}</span>
                <span
                  className="font-mono font-medium shrink-0"
                  style={{ color: item.impact < 0 ? '#10b981' : '#ef4444' }}
                >
                  {item.impact > 0 ? '+' : ''}{item.impact}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entropy — Output */}
      <div className="p-3 bg-dark-800/40 border border-dark-700/30 rounded-lg">
        {hasOutput ? (
          <EntropyMeter
            entropy={analysis.outputEntropy}
            classification={analysis.outputEntropyClass}
            label="Output Entropy"
          />
        ) : (
          <EntropyMeter
            entropy={analysis.inputEntropy}
            classification={analysis.inputEntropyClass}
            label="Input Entropy"
          />
        )}
      </div>

      {/* Size Comparison */}
      <div className="p-3 bg-dark-800/40 border border-dark-700/30 rounded-lg space-y-2">
        <div className="flex items-center gap-1 text-xs text-dark-400">
          <HardDrive size={12} />
          Size Comparison
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-dark-500 uppercase">Original</p>
            <p className="text-xs font-mono font-medium text-dark-300">
              {analysis.inputSize > 0 ? formatSize(analysis.inputSize) : '—'}
            </p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowUpDown size={12} className="text-dark-600" />
          </div>
          <div>
            <p className="text-[10px] text-dark-500 uppercase">Obfuscated</p>
            <p className="text-xs font-mono font-medium" style={{ color: hasOutput ? '#f97316' : '#484f58' }}>
              {hasOutput ? formatSize(analysis.outputSize) : '—'}
            </p>
          </div>
        </div>
        {hasOutput && (
          <div className="flex items-center justify-center gap-1 text-[10px]">
            <TrendingDown size={10} className="text-obf-amber" />
            <span className="text-dark-500">
              {analysis.sizeRatio}x size {Number(analysis.sizeRatio) > 1 ? 'increase' : 'decrease'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
