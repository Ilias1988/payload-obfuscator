import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import SEOHead from './components/seo/SEOHead'
import SEOContent from './components/seo/SEOContent'
import LanguageSelector from './components/panels/LanguageSelector'
import InputPanel from './components/panels/InputPanel'
import OutputPanel from './components/panels/OutputPanel'
import ObfuscationOptions from './components/panels/ObfuscationOptions'
import AnalysisPanel from './components/panels/AnalysisPanel'
import useObfuscator from './hooks/useObfuscator'

export default function App() {
  const {
    language,
    setLanguage,
    inputCode,
    setInputCode,
    outputCode,
    activeLayers,
    toggleLayer,
    obfuscate,
    analysis,
    clearAll,
    warnings,
    stealthActive,
  } = useObfuscator()

  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      {/* Dynamic SEO Head */}
      <SEOHead language={language} />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

        {/* Language Selector */}
        <LanguageSelector language={language} onSelect={(lang) => { setLanguage(lang); clearAll() }} />

        {/* Main Grid: Sidebar + Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] gap-4">

          {/* Left Sidebar — Layers + Analysis */}
          <div className="space-y-4 lg:order-1 order-3">
            {/* Obfuscation Layers */}
            <div className="bg-dark-850 border border-dark-700/30 rounded-lg p-3">
              <ObfuscationOptions
                language={language}
                activeLayers={activeLayers}
                onToggleLayer={toggleLayer}
                onObfuscate={obfuscate}
                hasInput={inputCode.trim().length > 0}
              />
            </div>

            {/* Analysis Panel */}
            <div className="bg-dark-850 border border-dark-700/30 rounded-lg p-3">
              <AnalysisPanel analysis={analysis} />
            </div>
          </div>

          {/* Input Panel */}
          <div className="bg-dark-850 border border-dark-700/30 rounded-lg overflow-hidden terminal-glow lg:order-2 order-1">
            <InputPanel
              language={language}
              inputCode={inputCode}
              onCodeChange={setInputCode}
              onClear={clearAll}
            />
          </div>

          {/* Output Panel */}
          <div className="bg-dark-850 border border-dark-700/30 rounded-lg overflow-hidden terminal-glow lg:order-3 order-2">
            <OutputPanel
              language={language}
              outputCode={outputCode}
              warnings={warnings}
              stealthActive={stealthActive}
            />
          </div>
        </div>

        {/* Mobile Obfuscate Button (visible on small screens when sidebar is below) */}
        <div className="lg:hidden">
          <button
            onClick={obfuscate}
            disabled={!inputCode.trim() || activeLayers.length === 0}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
              inputCode.trim() && activeLayers.length > 0
                ? 'bg-obf-red hover:bg-red-600 text-white shadow-lg shadow-obf-red/20'
                : 'bg-dark-700 text-dark-500 cursor-not-allowed'
            }`}
          >
            ⚡ Obfuscate Payload
          </button>
        </div>
      </main>

      {/* Educational SEO Section */}
      <SEOContent />

      {/* Footer */}
      <Footer />
    </div>
  )
}
