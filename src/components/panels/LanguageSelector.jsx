import { LANGUAGES } from '../../data/techniques'

export default function LanguageSelector({ language, onSelect }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-dark-800/50 border border-dark-700/50 rounded-lg overflow-x-auto">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.id}
          onClick={() => onSelect(lang.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all duration-200 ${
            language === lang.id
              ? 'bg-dark-700 text-gray-100 shadow-sm'
              : 'text-dark-400 hover:text-gray-200 hover:bg-dark-700/50'
          }`}
          style={language === lang.id ? { borderBottom: `2px solid ${lang.color}` } : {}}
        >
          <span className="text-sm">{lang.icon}</span>
          <span>{lang.name}</span>
        </button>
      ))}
    </div>
  )
}
