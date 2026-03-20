import { Shield } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-dark-700/30 bg-dark-950 px-5 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-2 text-dark-400 text-sm">
            <Shield size={16} className="text-obf-red/60" />
            <span>Payload Obfuscator</span>
            <span className="text-dark-600">|</span>
            <span className="text-dark-500 text-xs">Red Team Evasion Tool</span>
          </div>

          {/* Center */}
          <p className="text-dark-500 text-xs text-center">
            For <strong className="text-dark-400">educational</strong> and{' '}
            <strong className="text-dark-400">authorized security testing</strong> purposes only.
          </p>

          {/* Right */}
          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://ilias1988.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-400 hover:text-gray-200 transition-colors"
            >
              Website
            </a>
            <a
              href="https://github.com/Ilias1988"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-400 hover:text-gray-200 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/EliotGeo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-400 hover:text-gray-200 transition-colors"
            >
              X
            </a>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-dark-800/50 text-center">
          <p className="text-dark-600 text-[11px]">
            © {new Date().getFullYear()} Made with ❤️ by{' '}
            <a href="https://ilias1988.me/" target="_blank" rel="noopener noreferrer" className="text-dark-400 hover:text-gray-300">
              Ilias Georgopoulos
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
