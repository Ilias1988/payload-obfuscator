import { Layers, Zap } from 'lucide-react'
import { OBFUSCATION_LAYERS } from '../../data/techniques'

export default function ObfuscationOptions({ language, activeLayers, onToggleLayer, onObfuscate, hasInput }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-obf-amber" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
            Obfuscation Layers
          </span>
          {activeLayers.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-obf-red/15 text-obf-red rounded-full font-medium">
              {activeLayers.length} active
            </span>
          )}
        </div>
      </div>

      {/* Layers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {OBFUSCATION_LAYERS.map((layer) => {
          const isSupported = layer.supported.includes(language)
          const isActive = activeLayers.includes(layer.id)

          return (
            <button
              key={layer.id}
              onClick={() => isSupported && onToggleLayer(layer.id)}
              disabled={!isSupported}
              className={`group flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all duration-200 ${
                !isSupported
                  ? 'opacity-30 cursor-not-allowed border-dark-700/30 bg-dark-800/20'
                  : isActive
                    ? 'border-obf-red/30 bg-obf-red/5 hover:bg-obf-red/10'
                    : 'border-dark-700/30 bg-dark-800/30 hover:border-dark-600/50 hover:bg-dark-800/50'
              }`}
            >
              {/* Toggle */}
              <div
                className={`mt-0.5 layer-switch shrink-0 ${
                  isActive ? 'bg-obf-red' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`layer-switch-knob ${
                    isActive ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>

              {/* Info */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{layer.icon}</span>
                  <span className={`text-xs font-medium ${isActive ? 'text-gray-100' : 'text-dark-300'}`}>
                    {layer.name}
                  </span>
                </div>
                <p className="text-[11px] text-dark-500 leading-tight mt-0.5 line-clamp-1">
                  {layer.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Obfuscate Button */}
      <button
        onClick={onObfuscate}
        disabled={!hasInput || activeLayers.length === 0}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
          hasInput && activeLayers.length > 0
            ? 'bg-obf-red hover:bg-red-600 text-white shadow-lg shadow-obf-red/20 animate-pulse-glow'
            : 'bg-dark-700 text-dark-500 cursor-not-allowed'
        }`}
      >
        <Zap size={16} />
        Obfuscate Payload
      </button>

      {!hasInput && (
        <p className="text-[10px] text-dark-600 text-center">
          Paste a payload and select at least one layer
        </p>
      )}
    </div>
  )
}
