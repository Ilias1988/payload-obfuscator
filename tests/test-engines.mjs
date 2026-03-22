/**
 * Payload Obfuscator — Automated Test Suite
 * 
 * Tests every engine × every layer × multiple payloads
 * For Python/Bash: actually EXECUTES the obfuscated output
 * 
 * Run: npx vite-node tests/test-engines.mjs
 */

import { obfuscatePython } from '../src/engines/python.js'
import { obfuscatePowerShell } from '../src/engines/powershell.js'
import { obfuscateBash } from '../src/engines/bash.js'
import { obfuscateCSharp } from '../src/engines/csharp.js'
import { obfuscateGo } from '../src/engines/golang.js'
import { applyControlFlowFlattening } from '../src/engines/controlflow.js'
import { execSync, spawnSync } from 'child_process'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// ─── Colors ────────────────────────────────────
const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', B = '\x1b[36m', D = '\x1b[2m', N = '\x1b[0m'

// ─── Stats ─────────────────────────────────────
let total = 0, passed = 0, failed = 0, skipped = 0
const failures = []

// ─── Test Payloads ─────────────────────────────
const PYTHON_PAYLOADS = {
  'Simple print': `print("Hello World")`,

  'Variables & math': `
x = 10
y = 20
result = x + y
print(f"Result: {result}")
`,

  'Function + loop': `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

for i in range(1, 6):
    print(f"{i}! = {factorial(i)}")
`,

  'F-string with nested expr': `
data = {"name": "test", "value": 42}
key = "name"
print(f"Key={key}, Value={data.get(key)}")
`,

  'Implicit string concat': `
msg = ("Hello "
       "World "
       "Test")
print(msg)
`,

  'F-string implicit concat': `
x = 10
y = 20
print(f"x={x}, "
      f"y={y}, "
      f"sum={x+y}")
`,

  'Class with methods': `
class Calculator:
    def __init__(self, value=0):
        self.value = value
    
    def add(self, n):
        self.value += n
        return self
    
    def result(self):
        return self.value

calc = Calculator()
calc.add(5).add(3)
print(f"Result: {calc.result()}")
`,

  'Generator (yield)': `
def countdown(n):
    while n > 0:
        yield n
        n -= 1

for num in countdown(5):
    print(num)
`,

  'List comprehension': `
squares = [x**2 for x in range(10)]
evens = [x for x in squares if x % 2 == 0]
print(evens)
`,

  'Try/except': `
try:
    result = 10 / 2
    print(f"OK: {result}")
except ZeroDivisionError as err:
    print(f"Error: {err}")
`,

  'Global variable': `
counter = 0

def increment():
    global counter
    counter += 1

increment()
increment()
print(f"Counter: {counter}")
`,

  'Multi-line f-string with method calls': `
items = [1, 2, 3, 4, 5]
print(f"Length: {len(items)}, "
      f"Sum: {sum(items)}, "
      f"Max: {max(items)}")
`,

  'Ackermann (recursion)': `
import sys
sys.setrecursionlimit(2000)

def ackermann(m, n):
    if m == 0:
        return n + 1
    elif m > 0 and n == 0:
        return ackermann(m - 1, 1)
    else:
        return ackermann(m - 1, ackermann(m, n - 1))

print(f"ack(2,3)={ackermann(2, 3)}")
print(f"ack(3,2)={ackermann(3, 2)}")
`,

  'Decorator': `
def logger(func):
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        print(f"{func.__name__}({args}) = {result}")
        return result
    return wrapper

@logger
def multiply(a, b):
    return a * b

multiply(3, 4)
multiply(5, 6)
`,

  'Dataclass': `
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def distance(self):
        return (self.x**2 + self.y**2)**0.5

pt = Point(3.0, 4.0)
print(f"Point: ({pt.x}, {pt.y}), distance={pt.distance()}")
`,

  'Dynamic globals': `
stages = ["Init", "Run", "Done"]
for idx, stage in enumerate(stages):
    dynamic_var = f"STATUS_{stage.upper()}"
    globals()[dynamic_var] = idx * 10
    print(f"Stage {idx}: {globals().get(dynamic_var)}")
`,
}

const POWERSHELL_PAYLOADS = {
  'Simple Write-Output': `Write-Output "Hello World"`,

  'Variable + string interpolation': `
$name = "Test"
$value = 42
Write-Output "Name: $name, Value: $value"
`,

  'Function': `
function Get-Sum {
    param([int]$a, [int]$b)
    return $a + $b
}
$result = Get-Sum -a 10 -b 20
Write-Output "Sum: $result"
`,

  'ForEach loop': `
$items = @(1, 2, 3, 4, 5)
$total = 0
foreach ($item in $items) {
    $total += $item
}
Write-Output "Total: $total"
`,

  'Pipeline': `
$nums = 1..10
$sum = ($nums | Measure-Object -Sum).Sum
Write-Output "Sum 1-10: $sum"
`,

  'Try/Catch': `
try {
    $result = 100 / 5
    Write-Output "Result: $result"
} catch {
    Write-Output "Error: $_"
}
`,

  'Block comment': `
<#
  This is a block comment
  with multiple lines
#>
$x = 10
Write-Output "Value: $x"
`,

  'Here-string': `
$msg = @"
Hello
World
"@
Write-Output $msg
`,

  'Hashtable': `
$config = @{
    Name = "Test"
    Port = 8080
    Active = $true
}
Write-Output "Port: $($config.Port)"
`,
}

const BASH_PAYLOADS = {
  'Simple echo': `echo "Hello World"`,

  'Variables': `
name="TestUser"
value=42
echo "Name: $name, Value: $value"
`,

  'Function': `
add() {
    echo $(( $1 + $2 ))
}
result=$(add 10 20)
echo "Sum: $result"
`,

  'For loop': `
total=0
for i in 1 2 3 4 5; do
    total=$((total + i))
done
echo "Total: $total"
`,

  'If/else': `
x=10
if [ $x -gt 5 ]; then
    echo "Greater"
else
    echo "Smaller"
fi
`,

  'Array': 'arr=(one two three four)\nfor item in "${arr[@]}"; do\n    echo "Item: $item"\ndone\n',

  'Command substitution': `
today=$(date +%Y)
echo "Year: $today"
`,
}

const CSHARP_PAYLOADS = {
  'Simple Console': `
using System;
class Program {
    static void Main() {
        Console.WriteLine("Hello World");
    }
}
`,

  'Variables + loop': `
using System;
class Program {
    static void Main() {
        int sum = 0;
        for (int i = 1; i <= 10; i++) {
            sum += i;
        }
        Console.WriteLine($"Sum: {sum}");
    }
}
`,

  'Class with method': `
using System;
class Calculator {
    private int value;
    public Calculator() { value = 0; }
    public void Add(int n) { value += n; }
    public int Result() { return value; }
}
class Program {
    static void Main() {
        var calc = new Calculator();
        calc.Add(5);
        calc.Add(3);
        Console.WriteLine($"Result: {calc.Result()}");
    }
}
`,
}

const GO_PAYLOADS = {
  'Simple fmt.Println': `
package main
import "fmt"
func main() {
    fmt.Println("Hello World")
}
`,

  'Variables + loop': `
package main
import "fmt"
func main() {
    sum := 0
    for i := 1; i <= 10; i++ {
        sum += i
    }
    fmt.Printf("Sum: %d\\n", sum)
}
`,

  'Function': `
package main
import "fmt"
func add(a, b int) int {
    return a + b
}
func main() {
    result := add(10, 20)
    fmt.Printf("Result: %d\\n", result)
}
`,
}

// ─── Layer Combinations ────────────────────────
const PYTHON_LAYERS = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['antianalysis'],
  ['encrypt'],
  ['randomize', 'encode'],
  ['randomize', 'xorstrings'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'encode', 'encrypt'],
  ['randomize', 'xorstrings', 'deadcode', 'encrypt'],
  ['randomize', 'encode', 'deadcode', 'antianalysis', 'encrypt'],
  ['randomize', 'encode', 'xorstrings', 'deadcode', 'antianalysis', 'encrypt'],
]

const PS_LAYERS = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['antianalysis'],
  ['encrypt'],
  ['randomize', 'encode'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'encode', 'encrypt'],
  ['randomize', 'encode', 'deadcode', 'antianalysis', 'encrypt'],
]

const BASH_LAYERS = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['antianalysis'],
  ['encrypt'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'encode', 'encrypt'],
  ['randomize', 'encode', 'deadcode', 'antianalysis', 'encrypt'],
]

const CS_LAYERS = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['antianalysis'],
  ['encrypt'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'encode', 'deadcode', 'antianalysis', 'encrypt'],
]

const GO_LAYERS = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['antianalysis'],
  ['encrypt'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'encode', 'deadcode', 'antianalysis', 'encrypt'],
]

// ─── Helpers ───────────────────────────────────

function detectRuntime(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'pipe' })
    return true
  } catch { return false }
}

const HAS_PYTHON = detectRuntime('python') || detectRuntime('python3')
const PYTHON_CMD = detectRuntime('python') ? 'python' : 'python3'
const HAS_PWSH = detectRuntime('pwsh')
const HAS_BASH = detectRuntime('bash')

const TEMP_DIR = join(tmpdir(), 'payload-obfuscator-tests')
try { mkdirSync(TEMP_DIR, { recursive: true }) } catch {}

function execPython(code, timeoutMs = 15000) {
  const file = join(TEMP_DIR, `test_${Date.now()}_${Math.random().toString(36).slice(2)}.py`)
  try {
    writeFileSync(file, code, 'utf-8')
    const result = spawnSync(PYTHON_CMD, [file], {
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr, code: result.status }
  } finally {
    try { unlinkSync(file) } catch {}
  }
}

function execPwsh(code, timeoutMs = 15000) {
  const file = join(TEMP_DIR, `test_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`)
  try {
    writeFileSync(file, code, 'utf-8')
    const result = spawnSync('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], {
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr, code: result.status }
  } finally {
    try { unlinkSync(file) } catch {}
  }
}

function execBash(code, timeoutMs = 15000) {
  const file = join(TEMP_DIR, `test_${Date.now()}_${Math.random().toString(36).slice(2)}.sh`)
  try {
    writeFileSync(file, code, 'utf-8')
    const result = spawnSync('bash', [file], {
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr, code: result.status }
  } finally {
    try { unlinkSync(file) } catch {}
  }
}

function layerStr(layers) {
  return layers.join(' + ')
}

// ─── Test Runner ───────────────────────────────

function testObfuscation(engineName, engineFn, payloadName, payload, layers, execFn) {
  total++
  const tag = `[${engineName}] "${payloadName}" — ${layerStr(layers)}`

  // Phase 1: Obfuscation itself shouldn't crash
  let obfuscated
  try {
    obfuscated = engineFn(payload, layers)
  } catch (err) {
    failed++
    const msg = `${R}❌ OBFUSCATION CRASH${N}: ${err.message}`
    failures.push({ tag, phase: 'obfuscation', error: err.message, layers, payloadName, engine: engineName })
    console.log(`  ${tag}  ${msg}`)
    return
  }

  // Phase 2: Output should not be empty
  if (!obfuscated || obfuscated.trim().length === 0) {
    failed++
    failures.push({ tag, phase: 'empty-output', error: 'Empty output', layers, payloadName, engine: engineName })
    console.log(`  ${tag}  ${R}❌ EMPTY OUTPUT${N}`)
    return
  }

  // Phase 3: Execute if we have the runtime
  if (execFn) {
    try {
      const result = execFn(obfuscated)
      if (result.ok) {
        passed++
        console.log(`  ${tag}  ${G}✅ PASS${N} ${D}(exit 0)${N}`)
      } else {
        failed++
        const errSnippet = (result.stderr || '').split('\n').filter(l => l.trim()).slice(-3).join(' | ')
        failures.push({ tag, phase: 'execution', error: errSnippet, layers, payloadName, engine: engineName, obfuscatedLength: obfuscated.length })
        console.log(`  ${tag}  ${R}❌ EXEC FAIL${N} (exit ${result.code}): ${errSnippet.slice(0, 120)}`)
      }
    } catch (err) {
      failed++
      failures.push({ tag, phase: 'exec-crash', error: err.message, layers, payloadName, engine: engineName })
      console.log(`  ${tag}  ${R}❌ EXEC ERROR${N}: ${err.message.slice(0, 100)}`)
    }
  } else {
    // No runtime — just check obfuscation didn't crash
    passed++
    console.log(`  ${tag}  ${G}✅ PASS${N} ${Y}(no runtime, obfuscation only)${N}`)
  }
}

// Also test CFF separately
function testCFF(language, payload, payloadName) {
  total++
  const tag = `[CFF/${language}] "${payloadName}"`
  try {
    const result = applyControlFlowFlattening(payload, language)
    if (result && result.trim().length > 0) {
      passed++
      console.log(`  ${tag}  ${G}✅ PASS${N} ${D}(CFF applied)${N}`)
    } else {
      failed++
      failures.push({ tag, phase: 'cff-empty', error: 'CFF returned empty', engine: 'CFF', payloadName })
      console.log(`  ${tag}  ${R}❌ EMPTY${N}`)
    }
  } catch (err) {
    failed++
    failures.push({ tag, phase: 'cff-crash', error: err.message, engine: 'CFF', payloadName })
    console.log(`  ${tag}  ${R}❌ CRASH${N}: ${err.message.slice(0, 100)}`)
  }
}

// ─── Main ──────────────────────────────────────

console.log(`\n${B}🧪 Payload Obfuscator — Automated Test Suite${N}`)
console.log(`${'═'.repeat(60)}`)
console.log(`${D}Runtimes: Python=${HAS_PYTHON ? G+'YES'+N : R+'NO'+N}  PowerShell=${HAS_PWSH ? G+'YES'+N : R+'NO'+N}  Bash=${HAS_BASH ? G+'YES'+N : R+'NO'+N}${N}`)
console.log()

// ── Python Tests ───────────────────────────────
console.log(`${B}━━━ PYTHON ━━━${N}`)
for (const [name, payload] of Object.entries(PYTHON_PAYLOADS)) {
  for (const layers of PYTHON_LAYERS) {
    testObfuscation('Python', obfuscatePython, name, payload, layers, HAS_PYTHON ? execPython : null)
  }
}

// Python CFF
console.log(`\n${B}━━━ PYTHON CFF ━━━${N}`)
for (const [name, payload] of Object.entries(PYTHON_PAYLOADS)) {
  testCFF('python', payload, name)
}

// ── PowerShell Tests ───────────────────────────
console.log(`\n${B}━━━ POWERSHELL ━━━${N}`)
for (const [name, payload] of Object.entries(POWERSHELL_PAYLOADS)) {
  for (const layers of PS_LAYERS) {
    testObfuscation('PowerShell', obfuscatePowerShell, name, payload, layers, HAS_PWSH ? execPwsh : null)
  }
}

// PS CFF
console.log(`\n${B}━━━ POWERSHELL CFF ━━━${N}`)
for (const [name, payload] of Object.entries(POWERSHELL_PAYLOADS)) {
  testCFF('powershell', payload, name)
}

// ── Bash Tests ─────────────────────────────────
console.log(`\n${B}━━━ BASH ━━━${N}`)
for (const [name, payload] of Object.entries(BASH_PAYLOADS)) {
  for (const layers of BASH_LAYERS) {
    testObfuscation('Bash', obfuscateBash, name, payload, layers, HAS_BASH ? execBash : null)
  }
}

// Bash CFF
console.log(`\n${B}━━━ BASH CFF ━━━${N}`)
for (const [name, payload] of Object.entries(BASH_PAYLOADS)) {
  testCFF('bash', payload, name)
}

// ── C# Tests ───────────────────────────────────
console.log(`\n${B}━━━ C# ━━━${N}`)
for (const [name, payload] of Object.entries(CSHARP_PAYLOADS)) {
  for (const layers of CS_LAYERS) {
    testObfuscation('C#', obfuscateCSharp, name, payload, layers, null)
  }
}

// CS CFF
console.log(`\n${B}━━━ C# CFF ━━━${N}`)
for (const [name, payload] of Object.entries(CSHARP_PAYLOADS)) {
  testCFF('csharp', payload, name)
}

// ── Go Tests ───────────────────────────────────
console.log(`\n${B}━━━ GO ━━━${N}`)
for (const [name, payload] of Object.entries(GO_PAYLOADS)) {
  for (const layers of GO_LAYERS) {
    testObfuscation('Go', obfuscateGo, name, payload, layers, null)
  }
}

// Go CFF
console.log(`\n${B}━━━ GO CFF ━━━${N}`)
for (const [name, payload] of Object.entries(GO_PAYLOADS)) {
  testCFF('go', payload, name)
}

// ─── Final Report ──────────────────────────────
console.log(`\n${'═'.repeat(60)}`)
console.log(`${B}📊 RESULTS${N}`)
console.log(`${'═'.repeat(60)}`)
console.log(`  Total:   ${total}`)
console.log(`  ${G}Passed:  ${passed}${N}`)
console.log(`  ${R}Failed:  ${failed}${N}`)
console.log(`  Pass Rate: ${total > 0 ? ((passed/total)*100).toFixed(1) : 0}%`)

if (failures.length > 0) {
  console.log(`\n${R}━━━ FAILURE DETAILS ━━━${N}`)
  
  // Group by engine
  const byEngine = {}
  for (const f of failures) {
    if (!byEngine[f.engine]) byEngine[f.engine] = []
    byEngine[f.engine].push(f)
  }
  
  for (const [engine, engineFailures] of Object.entries(byEngine)) {
    console.log(`\n  ${Y}[${engine}]${N} — ${engineFailures.length} failures:`)
    for (const f of engineFailures) {
      console.log(`    ${R}●${N} "${f.payloadName}" [${f.layers ? layerStr(f.layers) : 'CFF'}]`)
      console.log(`      Phase: ${f.phase}`)
      console.log(`      Error: ${f.error?.slice(0, 200)}`)
    }
  }
}

console.log(`\n${D}Test temp dir: ${TEMP_DIR}${N}`)

// Exit code based on failures
process.exit(failed > 0 ? 1 : 0)
