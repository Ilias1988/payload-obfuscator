import { obfuscatePython } from '../src/engines/python.js'
import { execSync, spawnSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const R = '\x1b[31m', G = '\x1b[32m', N = '\x1b[0m'
let pass = 0, fail = 0

function test(name, code, layers) {
  let obf
  try { obf = obfuscatePython(code, layers) } catch(e) {
    fail++; console.log(`${R}❌${N} [${layers.join('+')}] ${name}: CRASH ${e.message}`); return
  }
  const f = join(tmpdir(), `qt_${Date.now()}_${Math.random().toString(36).slice(2)}.py`)
  writeFileSync(f, obf)
  const r = spawnSync('python', [f], { timeout: 10000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] })
  try { unlinkSync(f) } catch{}
  if (r.status === 0) { pass++; console.log(`${G}✅${N} [${layers.join('+')}] ${name}`) }
  else { fail++; console.log(`${R}❌${N} [${layers.join('+')}] ${name}: ${(r.stderr||'').split('\n').filter(l=>l.trim()).slice(-2).join(' | ').slice(0,150)}`) }
}

// BUG 1 tests: XOR + implicit concat
const implicitConcat = 'msg = ("Hello "\n       "World "\n       "Test")\nprint(msg)'
const fstringConcat = 'x = 10\ny = 20\nprint(f"x={x}, "\n      f"y={y}, "\n      f"sum={x+y}")'
const multiLineFstr = 'items = [1, 2, 3, 4, 5]\nprint(f"Length: {len(items)}, "\n      f"Sum: {sum(items)}, "\n      f"Max: {max(items)}")'

test('Implicit concat', implicitConcat, ['xorstrings'])
test('Implicit concat', implicitConcat, ['randomize', 'xorstrings'])
test('Implicit concat', implicitConcat, ['randomize', 'xorstrings', 'deadcode', 'encrypt'])
test('F-string implicit', fstringConcat, ['xorstrings'])
test('F-string implicit', fstringConcat, ['deadcode'])
test('F-string implicit', fstringConcat, ['randomize', 'xorstrings'])
test('Multi-line fstr', multiLineFstr, ['xorstrings'])
test('Multi-line fstr', multiLineFstr, ['deadcode'])

// BUG 2 tests: deadcode + function bodies
const funcLoop = 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nfor i in range(1, 6):\n    print(f"{i}! = {factorial(i)}")'
test('Function+loop', funcLoop, ['deadcode'])
test('Function+loop', funcLoop, ['randomize', 'deadcode'])

// BUG 3 test: class + xorstrings + deadcode + encrypt
const classMethods = 'class Calculator:\n    def __init__(self, value=0):\n        self.value = value\n    def add(self, n):\n        self.value += n\n        return self\n    def result(self):\n        return self.value\ncalc = Calculator()\ncalc.add(5).add(3)\nprint(f"Result: {calc.result()}")'
test('Class+methods', classMethods, ['randomize', 'xorstrings', 'deadcode', 'encrypt'])
test('Class+methods', classMethods, ['randomize', 'encode', 'deadcode', 'antianalysis', 'encrypt'])

// ALL LAYERS on complex payloads
test('ALL: func+loop', funcLoop, ['randomize', 'encode', 'xorstrings', 'deadcode', 'antianalysis', 'encrypt'])
test('ALL: implicit', implicitConcat, ['randomize', 'encode', 'xorstrings', 'deadcode', 'antianalysis', 'encrypt'])
test('ALL: fstring', fstringConcat, ['randomize', 'encode', 'xorstrings', 'deadcode', 'antianalysis', 'encrypt'])

console.log(`\n📊 ${pass} passed, ${fail} failed out of ${pass+fail}`)
process.exit(fail > 0 ? 1 : 0)
