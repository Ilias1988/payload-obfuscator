import { BookOpen, Shield, Zap, Eye, Scale, ChevronRight } from 'lucide-react'

/**
 * SEOContent — Educational section for SEO enrichment (400+ words)
 * Covers AV/EDR bypass theory, static vs dynamic analysis, and ethics of red teaming.
 * Placed before the footer to provide crawlable, keyword-rich content.
 */
export default function SEOContent() {
  return (
    <section
      id="education"
      className="relative px-5 py-16 bg-dark-900/50 border-t border-dark-700/30"
      aria-label="Educational content about payload obfuscation and evasion techniques"
    >
      <div className="max-w-4xl mx-auto space-y-10">

        {/* ── Section Title ──────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-obf-red/10 border border-obf-red/20 rounded-full text-obf-red text-xs font-medium tracking-wide uppercase">
            <BookOpen size={14} />
            Educational Resource
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 tracking-tight">
            Advanced Evasion Techniques &amp; Payload Obfuscation
          </h2>
          <p className="text-dark-400 text-base max-w-2xl mx-auto">
            A comprehensive guide to understanding code obfuscation, AV/EDR bypass mechanisms,
            and the ethics of red team operations.
          </p>
        </div>

        {/* ── Understanding Code Obfuscation ──────── */}
        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-obf-red shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Understanding Code Obfuscation in Offensive Security
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            Code obfuscation is a fundamental technique in <strong className="text-gray-200">offensive security</strong> that
            transforms readable source code into a functionally equivalent but significantly harder-to-analyze version.
            In the context of <strong className="text-gray-200">red team operations</strong> and{' '}
            <strong className="text-gray-200">penetration testing</strong>, obfuscation serves as a critical layer of
            defense evasion — making payloads less detectable by <strong className="text-gray-200">antivirus (AV)</strong> engines,{' '}
            <strong className="text-gray-200">Endpoint Detection and Response (EDR)</strong> solutions, and manual code review
            processes. Modern security infrastructure combines multiple detection mechanisms that an effective obfuscation
            strategy must address simultaneously.
          </p>
          <p className="text-dark-300 leading-relaxed pl-7">
            Modern security solutions rely on two primary analysis methods:{' '}
            <strong className="text-gray-200">static analysis</strong> and{' '}
            <strong className="text-gray-200">dynamic analysis</strong>. Static analysis examines code without executing it,
            searching for known malicious signatures, suspicious strings, and dangerous API calls. Dynamic analysis,
            conversely, executes the code in a controlled sandbox environment, monitoring its runtime behavior for malicious
            activity such as process injection, network callbacks, or file system modifications. Understanding both
            approaches is essential for crafting payloads that can navigate past these defensive layers during
            authorized security assessments.
          </p>
        </article>

        {/* ── Static vs Dynamic Analysis ──────────── */}
        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-obf-amber shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Static vs Dynamic Analysis: Why Obfuscation Matters
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            Effective <strong className="text-gray-200">payload obfuscation</strong> primarily targets static analysis engines.
            By transforming variable names into randomized strings, encoding string literals with{' '}
            <strong className="text-gray-200">Base64</strong> or <strong className="text-gray-200">XOR</strong> operations,
            and restructuring control flow with dead code insertion, the payload's static signature changes dramatically.
            This means that <strong className="text-gray-200">signature-based detection</strong> — which relies on matching
            known patterns — fails to identify the obfuscated variant.
          </p>
          <p className="text-dark-300 leading-relaxed pl-7">
            However, sophisticated EDR solutions increasingly employ{' '}
            <strong className="text-gray-200">behavioral analysis</strong> and{' '}
            <strong className="text-gray-200">heuristic detection</strong>. These systems monitor what code does at runtime,
            regardless of how it looks on disk. This is why advanced obfuscation strategies include anti-analysis
            techniques such as sleep timers (to outlast sandbox timeouts), environment checks (to detect virtual machines),
            and staged execution (to delay malicious behavior until the payload confirms it is running on a real target).
          </p>
        </article>

        {/* ── Variable Randomization & Entropy ────── */}
        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-obf-cyan shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Variable Randomization &amp; Shannon Entropy Considerations
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            <strong className="text-gray-200">Variable randomization</strong> replaces meaningful identifiers like{' '}
            <code className="text-obf-green font-mono text-sm bg-dark-800/80 px-1.5 py-0.5 rounded">$payload</code> or{' '}
            <code className="text-obf-green font-mono text-sm bg-dark-800/80 px-1.5 py-0.5 rounded">shellcode_buffer</code>{' '}
            with random strings such as{' '}
            <code className="text-obf-green font-mono text-sm bg-dark-800/80 px-1.5 py-0.5 rounded">$xK7mQ2</code>.
            While this effectively breaks static signatures, it introduces a measurable side effect: increased{' '}
            <strong className="text-gray-200">Shannon entropy</strong>. Security tools can flag files with abnormally
            high entropy as potentially packed or encrypted malware. A skilled red teamer balances randomization with
            natural-looking code patterns to maintain a realistic entropy profile — typically keeping values between
            4.0 and 5.5 on the Shannon scale.
          </p>
        </article>

        {/* ── Multi-Layer Strategy ────────────────── */}
        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <ChevronRight size={20} className="text-obf-purple shrink-0" />
            <h3 className="text-xl font-semibold text-gray-200">
              Multi-Layer Obfuscation Strategy
            </h3>
          </div>
          <p className="text-dark-300 leading-relaxed pl-7">
            Professional <strong className="text-gray-200">red team engagements</strong> rarely rely on a single
            obfuscation technique. Instead, operators apply multiple layers: string encoding wraps sensitive literals,
            variable randomization breaks known identifiers, dead code injection alters control flow graphs, and
            encryption wrappers add an outer protective layer. Each layer addresses a different detection vector,
            creating a <strong className="text-gray-200">defense-in-depth approach to evasion</strong>. The key is
            understanding which layers are effective against your specific target's security stack — combining
            too many layers can actually increase detection probability through elevated entropy and suspicious
            code patterns.
          </p>
        </article>

        {/* ── Ethics Box ──────────────────────────── */}
        <div className="ml-7 p-5 bg-dark-800/60 border border-dark-700/40 border-l-4 border-l-obf-green rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-obf-green font-semibold text-sm uppercase tracking-wide">
            <Scale size={16} />
            Ethics &amp; Responsible Use
          </div>
          <p className="text-dark-300 text-sm leading-relaxed">
            Payload obfuscation tools exist exclusively for <strong className="text-gray-200">authorized
            security testing</strong>, <strong className="text-gray-200">red team exercises</strong>, and{' '}
            <strong className="text-gray-200">educational research</strong>. All techniques demonstrated
            here should only be applied within the scope of a signed{' '}
            <strong className="text-gray-200">Rules of Engagement (RoE)</strong> document. Unauthorized
            use of these techniques against systems you do not own or have explicit permission to test
            is illegal and unethical. The goal of red teaming is to strengthen an organization's security
            posture by identifying vulnerabilities before real adversaries exploit them — making the
            digital world safer through proactive defense validation.
          </p>
        </div>

      </div>
    </section>
  )
}
