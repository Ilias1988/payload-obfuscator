import { Shield, BookOpen, Github } from 'lucide-react'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-dark-700/50 bg-dark-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-obf-red/10 border border-obf-red/20 rounded-lg">
            <Shield size={18} className="text-obf-red" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-100 leading-tight">
              Payload Obfuscator
            </h1>
            <p className="text-[10px] text-dark-400 leading-tight">
              Red Team Evasion Tool
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-3">
          <a
            href="#education"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-dark-300 hover:text-gray-100 bg-dark-800/50 border border-dark-700/50 rounded-md hover:border-dark-600 transition-colors"
          >
            <BookOpen size={13} />
            Learn More
          </a>
          <a
            href="https://github.com/Ilias1988"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-dark-300 hover:text-gray-100 bg-dark-800/50 border border-dark-700/50 rounded-md hover:border-dark-600 transition-colors"
          >
            <Github size={13} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  )
}
