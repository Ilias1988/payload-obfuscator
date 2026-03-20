import { Helmet } from 'react-helmet-async'

/**
 * SEO metadata per language — dynamically updates <title>, <meta>, and JSON-LD
 * based on the currently selected obfuscation language.
 */

const SEO_DATA = {
  powershell: {
    title: 'PowerShell Obfuscator — Red Team Payload Evasion & AMSI Bypass Tool',
    description:
      'Free online PowerShell Obfuscator for red teamers. Apply multi-layer obfuscation including string splitting, Base64 encoding, Invoke-Expression tricks, tick insertion, and variable randomization to bypass AV/EDR detection.',
    keywords:
      'PowerShell obfuscation, PowerShell obfuscator, AMSI bypass, PowerShell evasion, red team, AV bypass, EDR evasion, Invoke-Expression, Base64 encoding, penetration testing',
    jsonLdName: 'PowerShell Payload Obfuscator',
    jsonLdDescription:
      'Free online PowerShell obfuscation tool with multi-layer evasion techniques for red team operations and penetration testing.',
  },
  python: {
    title: 'Python Obfuscator — Payload Evasion & AV Bypass Tool for Red Teams',
    description:
      'Obfuscate Python payloads with exec/eval wrapping, base64+zlib encoding, chr() conversion, lambda chains, and __import__ obfuscation. Real-time entropy analysis and detection scoring.',
    keywords:
      'Python obfuscation, Python obfuscator, Python evasion, payload obfuscation, red team Python, AV bypass Python, exec eval obfuscation, penetration testing',
    jsonLdName: 'Python Payload Obfuscator',
    jsonLdDescription:
      'Obfuscate Python payloads with multi-layer evasion techniques including encoding, variable randomization, and entropy analysis.',
  },
  bash: {
    title: 'Bash Obfuscator — Shell Script Evasion Tool for Penetration Testing',
    description:
      'Obfuscate Bash shell scripts with variable substitution, hex encoding, eval+base64 wrapping, IFS manipulation, and dead code injection. Built for red teams and CTF competitions.',
    keywords:
      'Bash obfuscation, shell script obfuscator, Bash evasion, Linux payload, red team Bash, CTF tools, eval base64, IFS manipulation, penetration testing',
    jsonLdName: 'Bash Shell Obfuscator',
    jsonLdDescription:
      'Obfuscate Bash shell scripts for red team operations with multi-layer encoding and evasion techniques.',
  },
  csharp: {
    title: 'C# Obfuscator — .NET Payload Evasion & Defense Bypass Tool',
    description:
      'Obfuscate C# payloads with String.Concat operations, char array encoding, XOR encryption, reflection-based invocation, and dead code injection for .NET red team operations.',
    keywords:
      'C# obfuscation, .NET obfuscator, C# evasion, .NET payload, red team C#, XOR encryption, reflection, AMSI bypass .NET, penetration testing',
    jsonLdName: 'C# .NET Payload Obfuscator',
    jsonLdDescription:
      'Obfuscate C# and .NET payloads with XOR encryption, reflection, and multi-layer evasion techniques.',
  },
  go: {
    title: 'Go Obfuscator — Golang Payload Evasion Tool for Offensive Security',
    description:
      'Obfuscate Go/Golang payloads with byte array encoding, XOR runtime decryption, string building techniques, and syscall obfuscation for cross-platform red team operations.',
    keywords:
      'Go obfuscation, Golang obfuscator, Go evasion, Golang payload, red team Go, XOR decryption, byte array, syscall obfuscation, penetration testing',
    jsonLdName: 'Go/Golang Payload Obfuscator',
    jsonLdDescription:
      'Obfuscate Go payloads with byte array encoding, XOR decryption, and cross-platform evasion techniques.',
  },
}

const BASE_URL = 'https://payload-obfuscator.dev'

/* ── FAQ Schema — targets Google Rich Snippets ─────────────── */
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is code obfuscation?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Code obfuscation is the process of transforming readable source code into a functionally equivalent but significantly harder-to-analyze version. In offensive security, obfuscation is used to evade antivirus (AV) engines, Endpoint Detection and Response (EDR) solutions, and static analysis tools by altering the code\'s structure, variable names, and string literals while preserving its original functionality.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does variable randomization help in evasion?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Variable randomization replaces meaningful identifiers like $payload or shellcode_buffer with random strings such as $xK7mQ2 or aR9vB3n. This breaks static signature matching used by AV/EDR solutions, which often flag code containing known malicious variable names or patterns. However, excessive randomization increases Shannon entropy, which can itself trigger heuristic detection — requiring a balance between evasion and stealth.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can obfuscated payloads bypass EDR?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Obfuscated payloads can bypass static analysis components of EDR solutions by altering code signatures and hiding suspicious patterns. However, modern EDR systems also use behavioral analysis, memory scanning, and heuristic detection that monitor runtime behavior regardless of code appearance. Effective evasion requires combining obfuscation with anti-analysis techniques like sandbox detection, sleep timers, and staged execution.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is Shannon entropy in malware analysis?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Shannon entropy is a mathematical measure of randomness in data. In malware analysis, it\'s used to identify potentially packed, encrypted, or obfuscated code. Normal source code typically has entropy between 4.0-5.0, while heavily encoded or encrypted payloads show entropy above 6.0-7.0. Security tools flag high-entropy files as suspicious, making entropy management an important consideration in payload obfuscation.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does static analysis detect malicious code?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Static analysis examines code without executing it, using techniques like signature matching (comparing against databases of known malware patterns), heuristic analysis (identifying suspicious code structures), string analysis (searching for known malicious strings like IP addresses or shell commands), and entropy analysis (flagging packed or encrypted content). Obfuscation techniques target these detection methods by transforming the code\'s static representation.',
      },
    },
  ],
}

/* ── Breadcrumb Schema ──────────────────────────────────────── */
const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${BASE_URL}/`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Payload Obfuscator',
      item: `${BASE_URL}/`,
    },
  ],
}

export default function SEOHead({ language = 'powershell' }) {
  const seo = SEO_DATA[language] || SEO_DATA.powershell

  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: seo.jsonLdName,
    url: `${BASE_URL}/`,
    description: seo.jsonLdDescription,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web Browser',
    inLanguage: 'en',
    browserRequirements: 'Requires JavaScript',
    datePublished: '2026-03-20',
    dateModified: '2026-03-20',
    screenshot: `${BASE_URL}/og-image.png`,
    author: {
      '@type': 'Person',
      name: 'Ilias Georgopoulos',
      url: 'https://ilias1988.me/',
      sameAs: [
        'https://github.com/Ilias1988',
        'https://www.linkedin.com/in/ilias-georgopoulos-b491a3371/',
        'https://x.com/EliotGeo',
      ],
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    keywords: seo.keywords,
  }

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />

      {/* Open Graph */}
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />

      {/* Twitter */}
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />

      {/* Dynamic JSON-LD — WebApplication Schema */}
      <script type="application/ld+json">
        {JSON.stringify(webAppSchema)}
      </script>

      {/* FAQ Schema — Google Rich Snippets */}
      <script type="application/ld+json">
        {JSON.stringify(FAQ_SCHEMA)}
      </script>

      {/* Breadcrumb Schema */}
      <script type="application/ld+json">
        {JSON.stringify(BREADCRUMB_SCHEMA)}
      </script>
    </Helmet>
  )
}
