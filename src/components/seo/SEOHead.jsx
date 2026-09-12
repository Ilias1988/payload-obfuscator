import { Helmet } from 'react-helmet-async'

const SEO_DATA = {
  powershell: {
    title: 'PowerShell Obfuscator — Browser-Based Source Transformer',
    description:
      'Transform PowerShell source in the browser with identifier randomization, string encoding, XOR reconstruction, guarded dead-code insertion, and optional wrappers.',
    keywords:
      'PowerShell obfuscator, PowerShell source transformation, PowerShell encoding, code obfuscation, security lab, authorized testing',
    name: 'PowerShell Source Obfuscator',
  },
  python: {
    title: 'Python Obfuscator — Browser-Based Source Transformer',
    description:
      'Transform Python source in the browser with identifier randomization, compatible string encoding, XOR reconstruction, dead-code insertion, and runtime wrappers.',
    keywords:
      'Python obfuscator, Python source transformation, Python encoding, code obfuscation, security lab, authorized testing',
    name: 'Python Source Obfuscator',
  },
  bash: {
    title: 'Bash Obfuscator — Browser-Based Shell Script Transformer',
    description:
      'Transform Bash scripts in the browser with variable randomization, compatible string encoding, XOR reconstruction, dead-code insertion, and runtime wrappers.',
    keywords:
      'Bash obfuscator, shell script transformation, Bash encoding, code obfuscation, Linux lab, authorized testing',
    name: 'Bash Source Obfuscator',
  },
  csharp: {
    title: 'C# Obfuscator — Browser-Based Source Transformer',
    description:
      'Transform C# source with identifier randomization, compatible string encoding, XOR reconstruction, guarded control-flow changes, and runtime wrappers.',
    keywords:
      'C# obfuscator, .NET source transformation, C# encoding, code obfuscation, security lab, authorized testing',
    name: 'C# Source Obfuscator',
  },
  go: {
    title: 'Go Obfuscator — Experimental Browser-Based Source Transformer',
    description:
      'Experiment with Go source transformations including identifier randomization, compatible string encoding, XOR reconstruction, and runtime wrappers.',
    keywords:
      'Go obfuscator, Golang source transformation, Go encoding, code obfuscation, experimental developer tool',
    name: 'Experimental Go Source Obfuscator',
  },
}

const BASE_URL = 'https://payload-obfuscator.dev'

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What does Payload Obfuscator do?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Payload Obfuscator applies configurable, language-aware transformations to PowerShell, Python, Bash, C#, and Go source code and returns transformed source for inspection and runtime testing.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does entered source code leave the browser?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The source transformation runs in the browser and the application does not submit entered code to a payload-processing API. The hosted site uses Cloudflare Web Analytics for aggregate traffic statistics.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is generated output guaranteed to behave exactly like the original?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Generated source must be inspected and tested with the target runtime, arguments, input, and environment. Unsupported constructs may be preserved rather than transformed.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the heuristic score an antivirus scan result?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. The score is a relative indicator derived from selected transformations. It is not a result from an antivirus, EDR product, AMSI, or third-party scanning service.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the project intended for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The project is intended for education, code-transformation research, CTF labs, and authorized security testing on code and systems the user owns or has explicit permission to assess.',
      },
    },
  ],
}

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
    name: seo.name,
    url: `${BASE_URL}/`,
    description: seo.description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    inLanguage: 'en',
    browserRequirements: 'Requires JavaScript',
    datePublished: '2026-03-20',
    dateModified: '2026-09-12',
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
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />

      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />

      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />

      <script type="application/ld+json">
        {JSON.stringify(webAppSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(FAQ_SCHEMA)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(BREADCRUMB_SCHEMA)}
      </script>
    </Helmet>
  )
}
