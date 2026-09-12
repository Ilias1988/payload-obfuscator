/**
 * Python semantic regression suite.
 *
 * Every transformed fixture is executed and compared with the original
 * stdout, stderr, and exit status. Fixtures are intentionally benign.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { obfuscatePython } from '../src/engines/python.js'

const pythonProbe = spawnSync('python', ['--version'], { encoding: 'utf8' })
if (pythonProbe.status !== 0) {
  console.error('Python runtime not found on PATH.')
  process.exit(1)
}

const versionText = `${pythonProbe.stdout || ''}${pythonProbe.stderr || ''}`
const versionMatch = /Python\s+(\d+)\.(\d+)/.exec(versionText)
const supportsPep701 = versionMatch && (Number(versionMatch[1]) > 3 || Number(versionMatch[2]) >= 12)
const tempDir = mkdtempSync(join(tmpdir(), 'payload-obfuscator-python-'))
let fileCounter = 0

const fixtures = [
  {
    name: 'basic variables and Unicode',
    code: `name = "Ilias"\nvalues = [1, 2, 3]\nmessage = "Γειά σου 👋"\nprint(name, sum(values), message)\n`,
  },
  {
    name: 'escaped string semantics',
    code: `text = "line1\\nline2\\t\\"quoted\\""\nprint(repr(text))\n`,
  },
  {
    name: 'formatted f-string',
    code: `value = 12.3456\nprint(f"value={value:.2f}; repr={value!r}; literal={{ok}}")\n`,
  },
  {
    name: 'f-string expression',
    code: `data = {"key": 7}\nkey = "key"\nprint(f"answer={data[key] + 1}")\n`,
  },
  {
    name: 'external keyword arguments',
    code: `import json\ndata = {"b": 1, "a": 2}\nprint(json.dumps(\n    data,\n    ensure_ascii=False,\n    separators=(",", ":"),\n    sort_keys=True,\n))\n`,
  },
  {
    name: 'keyword and local name collision',
    code: `timeout = 5\nprint(dict(value=timeout), timeout)\n`,
  },
  {
    name: 'function parameters and keyword calls',
    code: `value = 3\ndef use(value=8):\n    return value + 1\nprint(value, use(value=10))\n`,
  },
  {
    name: 'closures global and nonlocal',
    code: `counter = 1\ndef outer():\n    total = 2\n    def inner():\n        nonlocal total\n        global counter\n        total += 3\n        counter += 4\n        return total\n    return inner()\nprint(outer(), counter)\n`,
  },
  {
    name: 'decorator args and kwargs',
    code: `def decorate(fn):\n    def wrapped(*args, **kwargs):\n        return "[" + fn(*args, **kwargs) + "]"\n    return wrapped\n@decorate\ndef hello(name):\n    return f"hello {name}"\nprint(hello("Ilias"))\n`,
  },
  {
    name: 'dataclass default field',
    code: `from dataclasses import dataclass\n@dataclass\nclass Config:\n    timeout: int = 5\nconfig = Config()\nprint(config.timeout)\n`,
  },
  {
    name: 'reflection fallback',
    code: `secret_value = 42\nprint(globals()["secret_value"])\n`,
  },
  {
    name: 'raw and byte strings',
    code: `raw = r"C:\\temp\\new"\ndata = b"abc\\x00def"\nprint(raw, data.hex())\n`,
  },
  {
    name: 'module docstring and future import',
    code: `"""module docs"""\nfrom __future__ import annotations\nmessage = "future works"\nclass Node:\n    def child(self) -> Node | None:\n        return None\nprint(__doc__, message, Node().child())\n`,
  },
  {
    name: 'multiline function docstring',
    code: `def docs():\n    """Line one.\n    Content with ( [ { and # text.\n    Line three.\n    """\n    return docs.__doc__.splitlines()[0]\nprint(docs())\n`,
  },
  {
    name: 'async and match patterns',
    code: `import asyncio\nasync def classify(value):\n    await asyncio.sleep(0)\n    match value:\n        case {"kind": kind, "items": items}:\n            return f"{kind}:{len(items)}"\n        case _:\n            return "none"\nprint(asyncio.run(classify({"kind": "ok", "items": [1, 2]})))\n`,
  },
  {
    name: 'implicit concatenation',
    code: `message = ("hello " "world " f"{2 + 3}")\nprint(message)\n`,
  },
  {
    name: 'comprehensions generators and unpacking',
    code: `pairs = [(1, 2), (3, 4)]\nvalues = (a + b for a, b in pairs)\nprint([value * 2 for value in values])\n`,
  },
  {
    name: 'CLI arguments',
    code: `import sys\nlabel = sys.argv[1]\namount = int(sys.argv[2])\nprint(f"{label}:{amount + 1}")\n`,
    args: ['demo', '41'],
  },
]

if (supportsPep701) {
  fixtures.push({
    name: 'Python 3.12 PEP 701 f-string',
    code: `data = {"key": "works"}\nprint(f"PEP701={data["key"]}")\n`,
  })
}

const layerMatrix = [
  [],
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['encrypt'],
  ['randomize', 'encode'],
  ['randomize', 'xorstrings'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'xorstrings', 'deadcode', 'encrypt'],
  ['randomize', 'encode', 'xorstrings', 'deadcode', 'encrypt'],
]

function execute(code, args = []) {
  const file = join(tempDir, `case-${fileCounter++}.py`)
  writeFileSync(file, code, 'utf8')
  const result = spawnSync('python', [file, ...args], {
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || '',
  }
}

function sameResult(expected, actual) {
  return expected.status === actual.status &&
    expected.signal === actual.signal &&
    expected.stdout === actual.stdout &&
    expected.stderr === actual.stderr
}

let total = 0
let passed = 0
const failures = []

function check(name, source, layers, args = []) {
  total++
  const expected = execute(source, args)
  if (expected.status !== 0) throw new Error(`Invalid fixture "${name}": ${expected.stderr || expected.error}`)

  let transformed
  try {
    transformed = obfuscatePython(source, layers)
  } catch (error) {
    failures.push({ name, layers, reason: `transform crashed: ${error.message}` })
    return
  }

  const actual = execute(transformed, args)
  if (sameResult(expected, actual)) {
    passed++
    return
  }

  failures.push({
    name,
    layers,
    reason: actual.status !== expected.status
      ? `exit ${actual.status}: ${(actual.stderr || actual.error).trim().split(/\r?\n/).slice(-3).join(' | ')}`
      : `output mismatch: expected ${JSON.stringify(expected.stdout)}, got ${JSON.stringify(actual.stdout)}`,
  })
}

try {
  for (const fixture of fixtures) {
    for (const layers of layerMatrix) {
      for (let iteration = 0; iteration < 2; iteration++) {
        check(`${fixture.name} #${iteration + 1}`, fixture.code, layers, fixture.args)
      }
    }
  }

  // Exercise all four randomized wrappers repeatedly, especially with non-BMP Unicode.
  const unicodeFixture = fixtures[0]
  for (let iteration = 0; iteration < 24; iteration++) {
    check(`Unicode encryption stress #${iteration + 1}`, unicodeFixture.code, ['encrypt'])
  }

  // These combinations verify legal placement after docstrings and future imports.
  const futureFixture = fixtures.find((fixture) => fixture.name.includes('future import'))
  for (const layers of [
    ['antianalysis'],
    ['xorstrings', 'antianalysis'],
    ['antianalysis', 'encrypt'],
  ]) {
    check('Anti-analysis preamble placement', futureFixture.code, layers)
  }

  total++
  if (obfuscatePython('', ['encrypt']) === '') passed++
  else failures.push({ name: 'empty input', layers: ['encrypt'], reason: 'did not return an empty string' })

  console.log(`${versionText.trim()} — ${passed}/${total} semantic checks passed.`)
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure.name} [${failure.layers.join(', ')}]: ${failure.reason}`)
    }
    process.exitCode = 1
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
