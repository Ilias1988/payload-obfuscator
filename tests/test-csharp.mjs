import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { obfuscateCSharp } from '../src/engines/csharp.js'

const frameworkCompiler = String.raw`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`
const compiler = process.env.CSC_PATH || (existsSync(frameworkCompiler) ? frameworkCompiler : 'csc')
const compilerProbe = spawnSync(compiler, ['/nologo', '/help'], { encoding: 'utf8', timeout: 10000 })

if (compilerProbe.error?.code === 'ENOENT') {
  console.log('C# tests skipped: set CSC_PATH or install a C# compiler.')
  process.exit(0)
}

const tempDirectory = mkdtempSync(join(tmpdir(), 'payload-obfuscator-csharp-'))
let sequence = 0
let passed = 0
let failed = 0
const failures = []

const functionalFixture = readFileSync(new URL('./csharp-functional-test.cs', import.meta.url), 'utf8')
const membersFixture = `using System;
using System.Text;

namespace Demo
{
    class Counter
    {
        private int value;
        public Counter(int start) { this.value = start; }
        public void Add(int amount) { this.value += amount; }
        public int Result() { return this.value; }
    }

    class Program
    {
        static void Main()
        {
            Console.OutputEncoding = new UTF8Encoding(false);
            Counter counter = new Counter(5);
            counter.Add(7);
            Console.WriteLine("Counter=" + counter.Result());
            Console.WriteLine("Unicode=Καλημέρα");
        }
    }
}
`

const interpolationFixture = `using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Threading;

class Program
{
    static void Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
        string name = "Ilias";
        double amount = 12.345;
        var data = new Dictionary<string, string>();
        data["key"] = "VALUE";
        char letter = '\\u0393';
        string escapedUnicode = "\\u0393";
        string literalUnicodeEscape = "\\\\u0393";
        Console.WriteLine($"Name={name}; Upper={name.ToUpper()}; Amount={amount,8:0.00}; Literal={{ok}}; Dict={data["key"]}");
        Console.WriteLine($"Expr={1 + 2}; Letter={letter}; Escaped={escapedUnicode}; LiteralEscape={literalUnicodeEscape}");
    }
}
`

const layerMatrices = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['controlflow'],
  ['antianalysis'],
  ['encrypt'],
  ['randomize', 'encode'],
  ['randomize', 'xorstrings'],
  ['encode', 'deadcode'],
  ['randomize', 'encode', 'deadcode', 'controlflow'],
  ['randomize', 'encode', 'xorstrings', 'deadcode', 'controlflow', 'antianalysis', 'encrypt'],
]

const interpolationMatrices = [
  ['encode'],
  ['xorstrings'],
  ['encrypt'],
  ['randomize', 'encode'],
  ['randomize', 'xorstrings'],
  ['encode', 'deadcode', 'controlflow'],
  ['randomize', 'encode', 'xorstrings', 'deadcode', 'controlflow', 'antianalysis', 'encrypt'],
]

function compileAndRun(source, args = []) {
  const id = String(sequence++).padStart(4, '0')
  const sourceFile = join(tempDirectory, `${id}.cs`)
  const executable = join(tempDirectory, `${id}.exe`)
  writeFileSync(sourceFile, '\uFEFF' + source, 'utf8')

  const compile = spawnSync(compiler, ['/nologo', '/target:exe', `/out:${executable}`, sourceFile], {
    encoding: 'utf8', timeout: 20000,
  })
  if (compile.status !== 0) {
    return { phase: 'compile', status: compile.status, output: `${compile.stdout || ''}${compile.stderr || ''}` }
  }

  const run = spawnSync(executable, args, { encoding: 'utf8', timeout: 20000 })
  return {
    phase: 'run',
    status: run.status,
    stdout: run.stdout,
    output: `${run.stderr || ''}${run.error?.message || ''}`,
  }
}

function record(name, ok, detail = '') {
  if (ok) {
    passed++
    return
  }
  failed++
  failures.push({ name, detail: detail.slice(0, 1200) })
}

function runSemanticMatrix(name, source, matrices, expected, args = []) {
  for (const layers of matrices) {
    for (let repeat = 0; repeat < 3; repeat++) {
      let transformed
      try {
        transformed = obfuscateCSharp(source, layers)
      } catch (error) {
        record(`${name} [${layers.join('+')}] #${repeat + 1}`, false, `transform: ${error.message}`)
        continue
      }
      const actual = compileAndRun(transformed, args)
      const ok = actual.phase === 'run' && actual.status === 0 && actual.stdout === expected
      record(`${name} [${layers.join('+')}] #${repeat + 1}`, ok,
        `${actual.phase} exit=${actual.status}\n${actual.output}\nstdout=${JSON.stringify(actual.stdout)}\nexpected=${JSON.stringify(expected)}`)
    }
  }
}

try {
  const functionalBaseline = compileAndRun(functionalFixture, ['Ilias'])
  record('functional fixture baseline', functionalBaseline.phase === 'run' && functionalBaseline.status === 0, functionalBaseline.output)
  const membersBaseline = compileAndRun(membersFixture)
  record('members fixture baseline', membersBaseline.phase === 'run' && membersBaseline.status === 0, membersBaseline.output)

  runSemanticMatrix('functional', functionalFixture, layerMatrices, functionalBaseline.stdout, ['Ilias'])
  runSemanticMatrix('members', membersFixture, layerMatrices, membersBaseline.stdout)

  const interpolationExpected = 'Name=Ilias; Upper=ILIAS; Amount=   12.35; Literal={ok}; Dict=VALUE\r\n' +
    'Expr=3; Letter=Γ; Escaped=Γ; LiteralEscape=\\u0393\r\n'
  runSemanticMatrix('interpolation', interpolationFixture, interpolationMatrices, interpolationExpected)

  const rawString = 'class Program { static void Main() { var text = """raw { text }"""; } }'
  const rawResult = obfuscateCSharp(rawString, ['randomize', 'encode', 'xorstrings', 'deadcode', 'controlflow', 'antianalysis', 'encrypt'])
  record('C# 11 raw strings are preserved safely', rawResult === rawString, rawResult)
  record('empty input', obfuscateCSharp('', ['encode']) === '')
  record('whitespace input', obfuscateCSharp('   ', ['xorstrings']) === '')
} finally {
  rmSync(tempDirectory, { recursive: true, force: true })
}

console.log(`C# semantic tests: ${passed}/${passed + failed} passed`)
if (failures.length) console.log(JSON.stringify(failures, null, 2))
process.exitCode = failed ? 1 : 0
