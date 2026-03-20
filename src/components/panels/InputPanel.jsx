import { Terminal, Trash2, FileCode } from 'lucide-react'
import { LANGUAGES, TEMPLATES } from '../../data/techniques'
import { useState } from 'react'

export default function InputPanel({ language, inputCode, onCodeChange, onClear }) {
  const [showTemplates, setShowTemplates] = useState(false)
  const langData = LANGUAGES.find((l) => l.id === language)
  const availableTemplates = TEMPLATES.filter((t) => t.language === language)

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
            <Terminal size={13} className="text-dark-400" />
            <span className="text-xs text-dark-400 font-medium">
              Input — {langData?.name || 'Code'}{langData?.extension || ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {availableTemplates.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-dark-400 hover:text-gray-200 bg-dark-700/30 hover:bg-dark-700/60 border border-dark-600/30 rounded transition-colors"
              >
                <FileCode size={11} />
                Templates
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-dark-800 border border-dark-600/50 rounded-lg shadow-xl shadow-black/40 z-20">
                  <div className="p-2 space-y-1">
                    {availableTemplates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => {
                          onCodeChange(tmpl.code)
                          setShowTemplates(false)
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs text-dark-300 hover:text-gray-100 hover:bg-dark-700/60 rounded-md transition-colors"
                      >
                        <span className="mr-1.5">{tmpl.icon}</span>
                        {tmpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-dark-400 hover:text-obf-red bg-dark-700/30 hover:bg-dark-700/60 border border-dark-600/30 rounded transition-colors"
            title="Clear"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <textarea
          value={inputCode}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder={langData?.placeholder || 'Paste your payload here...'}
          spellCheck={false}
          className="w-full h-full min-h-[280px] lg:min-h-[400px] p-4 bg-dark-900 text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder:text-dark-600 rounded-b-lg"
          style={{ tabSize: 2 }}
        />
        {/* Line count */}
        {inputCode && (
          <div className="absolute bottom-2 right-3 text-[10px] text-dark-600 font-mono">
            {inputCode.split('\n').length} lines · {inputCode.length} chars
          </div>
        )}
      </div>
    </div>
  )
}
