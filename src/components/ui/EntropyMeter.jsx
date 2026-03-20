import { Activity } from 'lucide-react'

/**
 * EntropyMeter — Visual entropy indicator
 * Shows Shannon entropy as a gradient bar with classification labels.
 */
export default function EntropyMeter({ entropy, classification, label = 'Entropy' }) {
  if (!classification) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-dark-400 flex items-center gap-1">
          <Activity size={12} />
          {label}
        </span>
        <span className="font-mono font-medium" style={{ color: classification.color }}>
          {entropy.toFixed(3)} <span className="text-dark-500">/ 8.0</span>
        </span>
      </div>

      {/* Entropy bar */}
      <div className="relative h-2 bg-dark-700 rounded-full overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 entropy-gradient opacity-20 rounded-full" />
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${classification.percentage}%`,
            backgroundColor: classification.color,
            boxShadow: `0 0 8px ${classification.color}40`,
          }}
        />
      </div>

      {/* Classification */}
      <div className="flex items-center justify-between text-xs">
        <span
          className="font-medium px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
          style={{
            color: classification.color,
            backgroundColor: `${classification.color}15`,
          }}
        >
          {classification.label}
        </span>
        <span className="text-dark-500 text-[11px] max-w-[200px] text-right leading-tight">
          {classification.risk}
        </span>
      </div>
    </div>
  )
}
