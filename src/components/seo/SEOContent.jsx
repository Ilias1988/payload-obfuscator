import {
  BarChart3,
  BookOpen,
  Braces,
  CheckCircle2,
  LockKeyhole,
  Scale,
} from 'lucide-react'

/**
 * Crawlable product documentation shown below the application.
 * The copy intentionally describes capabilities and limitations without
 * presenting heuristic values as third-party security scan results.
 */
export default function SEOContent() {
  return (
    <section
      id="education"
      className="relative px-5 py-16 bg-dark-900/50 border-t border-dark-700/30"
      aria-label="How Payload Obfuscator works"
    >
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-obf-red/10 border border-obf-red/20 rounded-full text-obf-red text-xs font-medium tracking-wide uppercase">
            <BookOpen size={14} />
            Product Guide
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 tracking-tight">
            What Payload Obfuscator Does
          </h2>
          <p className="text-dark-400 text-base max-w-2xl mx-auto">
            A browser-based playground for transforming, inspecting, and testing
            PowerShell, Python, Bash, C#, and Go source code.
          </p>
        </div>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Braces size={20} className="text-obf-cyan shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Language-Aware Source Transformation
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            Paste source code, choose the transformations supported by its language,
            and generate a new source representation. Depending on the selected
            engine, the tool can rename recognized identifiers, encode compatible
            string literals, reconstruct strings with XOR, inject non-functional
            statements, restructure supported control flow, or add a runtime wrapper.
            The engines protect known syntax and skip constructs they cannot transform
            safely.
          </p>
          <p className="text-dark-300 leading-relaxed pl-7">
            PowerShell, Python, Bash, and C# are covered by local semantic tests that
            execute or compile benign fixtures and compare their behavior. Go support
            remains experimental and should receive the same runtime validation before
            being treated as stable.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-obf-green shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Verification Is Part of the Workflow
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            Generated output is source code, not a promise of compatibility. Keep the
            original program as a baseline, test one layer at a time, and then compile
            or execute the combined output with the same runtime, arguments, input, and
            environment. Compare standard output, errors, exit status, and side effects.
            Randomized transformations can produce different output on each run, so
            important programs should be tested more than once.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-obf-amber shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Understanding the Analysis Panel
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            The dashboard compares input and output size, calculates Shannon entropy,
            and displays a relative heuristic score based on the selected layers. These
            values help explain how a transformation changed the source. They are not
            results from Microsoft Defender, AMSI, an EDR product, VirusTotal, or any
            other security scanner, and they do not predict whether code will be allowed
            to run on a particular endpoint.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <LockKeyhole size={20} className="text-obf-purple shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Local Processing and Site Analytics
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            Source transformations run in the browser and the application does not send
            entered code to a payload-processing API. The hosted site uses Cloudflare
            Web Analytics for aggregate traffic statistics. As a general safety rule,
            never paste secrets, credentials, private keys, or production-only source
            into any web application.
          </p>
        </article>

        <div className="ml-7 p-5 bg-dark-800/60 border border-dark-700/40 border-l-4 border-l-obf-green rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-obf-green font-semibold text-sm uppercase tracking-wide">
            <Scale size={16} />
            Responsible Use
          </div>
          <p className="text-dark-300 text-sm leading-relaxed">
            This project is intended for education, code-transformation research,
            CTF labs, and authorized security testing. Obfuscation does not make unsafe
            code safe and does not guarantee antivirus or EDR bypass. Only test code and
            systems you own or are explicitly permitted to assess, preferably in an
            isolated environment with documented rules of engagement.
          </p>
        </div>
      </div>
    </section>
  )
}
