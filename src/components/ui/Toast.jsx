import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'

export default function Toast({ message, visible, onClose }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 2500)
      return () => clearTimeout(timer)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-obf-green/30 rounded-lg shadow-lg shadow-black/30">
        <CheckCircle size={16} className="text-obf-green" />
        <span className="text-sm text-gray-200">{message}</span>
      </div>
    </div>
  )
}
