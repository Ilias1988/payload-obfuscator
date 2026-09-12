import { spawnSync } from 'node:child_process'
import { obfuscatePowerShell } from '../src/engines/powershell.js'

const payloads = {
  'simple output': 'Write-Output "Hello World"',
  'case-insensitive variable': '$Name = "Test"\nWrite-Output $name',
  'interpolation': '$name = "Test"\n$value = 42\nWrite-Output "Name: $name, Value: $value"',
  'named function parameters': `function Get-Sum {
    param([int]$a, [int]$b)
    return $a + $b
}
$result = Get-Sum -a 10 -b 20
Write-Output "Sum: $result"`,
  'foreach loop': '$items = @(1,2,3,4,5)\n$total = 0\nforeach ($item in $items) { $total += $item }\nWrite-Output "Total: $total"',
  'pipeline': '$sum = (1..10 | Measure-Object -Sum).Sum\nWrite-Output "Sum: $sum"',
  'try catch': 'try { $result = 100 / 5; Write-Output "Result: $result" } catch { Write-Output "Error: $_" }',
  'here string': '$msg = @"\nHello\nWorld\n"@\nWrite-Output $msg',
  'hashtable': '$config = @{ Name = "Test"; Port = 8080 }\nWrite-Output "Port: $($config.Port)"',
  'unicode': '$message = "Γειά σου κόσμε 👋"\nWrite-Output $message',
  'scoped variable': '$script:Counter = 2\n$script:Counter += 3\nWrite-Output $script:Counter',
  'switch statement': '$value = 2\nswitch ($value) { 1 { "one" } 2 { "two" } default { "other" } }',
  'splatting': `function Join-Values { param([string]$First, [string]$Second) "$First-$Second" }
$params = @{ First = 'A'; Second = 'B' }
Join-Values @params`,
  'automatic PSBoundParameters': `function Test-Bound { param([string]$Name) if ($PSBoundParameters.ContainsKey('Name')) { "bound:$Name" } else { 'missing' } }
Test-Bound -Name Ilias`,
  'if else adjacency': `$x = 2
if ($x -eq 2) {
    'yes'
}
else {
    'no'
}`,
  'do while adjacency': `$i = 0
do {
    $i++
}
while ($i -lt 2)
"i=$i"`,
  'here string stress': `$msg = @"
alpha
beta
gamma
delta
epsilon
"@
$msg`,
  'multiline hashtable and interpolating here string': `$mode = 'EXPECTED'
$count = 3
$summary = [ordered]@{
    mode = $mode
    count = $count
    nested = [ordered]@{
        enabled = $true
        label = 'safe'
    }
} | ConvertTo-Json -Compress
$template = @"
Mode=$mode
Count=$count
"@
($template.Trim() -replace "\`r?\`n", ';')
$summary`,
  'escaped double quote': `$name = 'Ilias'
"He said \`"hello\`" to $name"`,
  'escaped interpolation': `$name = 'Ilias'
"literal \`$name and @params; real=$name"`,
  'script parameter default': `param([string]$Name = "Default Value")
Write-Output $Name`,
  'using namespace': `using namespace System.Text
[Encoding]::UTF8.WebName`,
  'advanced function': `function Get-Greeting {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)
    process { "Hello $Name" }
}
Get-Greeting -Name Ilias`,
}

const standardLayerSets = [
  ['randomize'],
  ['encode'],
  ['xorstrings'],
  ['deadcode'],
  ['controlflow'],
  ['encrypt'],
  ['randomize', 'encode'],
  ['randomize', 'xorstrings'],
  ['deadcode', 'controlflow'],
  ['randomize', 'encode', 'deadcode', 'controlflow', 'encrypt'],
  ['randomize', 'encode', 'xorstrings', 'deadcode', 'controlflow', 'encrypt'],
]

const antiAnalysisPayloads = ['simple output', 'interpolation', 'named function parameters']
const failures = []
let passed = 0
let skipped = 0
const originalResults = new Map()
const quickMode = process.env.PO_TEST_QUICK === '1'
const stressRuns = Number.parseInt(process.env.PO_STRESS_RUNS || '20', 10)

function normalize(value) {
  return typeof value === 'object' && value !== null ? value.code : value
}

function detectRuntime() {
  const requested = process.env.PO_POWERSHELL_RUNTIME
  const candidates = requested ? [requested] : ['pwsh', 'powershell']
  for (const runtime of candidates) {
    const check = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'Write-Output $PSVersionTable.PSVersion'], {
      encoding: 'utf8',
      timeout: 5000,
    })
    if (check.status === 0) return { runtime, version: normalizedText(check.stdout) }
  }
  return null
}

function quotePowerShellArgument(value) {
  const text = String(value)
  if (/^-[a-zA-Z][a-zA-Z0-9_-]*$/.test(text)) return text
  return `'${text.replaceAll("'", "''")}'`
}

function runPowerShell(code, args = []) {
  const encoded = Buffer.from(code, 'utf8').toString('base64')
  const invocationArgs = args.map(quotePowerShellArgument).join(' ')
  const runner = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$__source = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encoded}'))
$__script = [ScriptBlock]::Create($__source)
& $__script ${invocationArgs}`

  return spawnSync(runtimeInfo.runtime, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'], {
    encoding: 'utf8',
    timeout: 20000,
    input: runner,
  })
}

function normalizedText(value) {
  return (value || '').replaceAll('\r\n', '\n').trimEnd()
}

function testEquivalent(name, source, layers, args = []) {
  const cacheKey = `${source}\u0000${JSON.stringify(args)}`
  let original = originalResults.get(cacheKey)
  if (!original) {
    original = runPowerShell(source, args)
    originalResults.set(cacheKey, original)
  }
  const generated = normalize(obfuscatePowerShell(source, layers))
  const result = runPowerShell(generated, args)
  const expectedOut = normalizedText(original.stdout)
  const actualOut = normalizedText(result.stdout)
  const actualErr = normalizedText(result.stderr)

  if (original.status !== 0) {
    throw new Error(`Invalid test fixture "${name}": ${normalizedText(original.stderr)}`)
  }

  if (typeof generated !== 'string' || generated.trim().length === 0) {
    failures.push({ name, layers, reason: 'empty output' })
    return
  }

  if (result.status !== 0 || actualErr !== '' || actualOut !== expectedOut) {
    failures.push({
      name,
      layers,
      reason: 'behavior mismatch',
      status: result.status,
      expected: expectedOut,
      actual: actualOut,
      stderr: actualErr.slice(0, 500),
    })
    return
  }

  passed++
}

const runtimeInfo = detectRuntime()
if (!runtimeInfo) {
  console.error('PowerShell 7 or Windows PowerShell 5.1 is required for this test suite.')
  process.exit(2)
}

for (const [name, source] of Object.entries(payloads)) {
  if (!quickMode) {
    for (const layers of standardLayerSets) testEquivalent(name, source, layers)
  }
}

const cpuCheck = spawnSync(runtimeInfo.runtime, ['-NoProfile', '-Command', '[Environment]::ProcessorCount'], { encoding: 'utf8', timeout: 5000 })
if (Number.parseInt(cpuCheck.stdout, 10) >= 2) {
  for (const name of antiAnalysisPayloads) testEquivalent(name, payloads[name], ['antianalysis'])
} else {
  skipped += antiAnalysisPayloads.length
}

// Exercise randomized wrapper/dead-code variants repeatedly.
for (let i = 0; i < (quickMode ? 0 : stressRuns); i++) {
  testEquivalent('encryption stress', payloads['simple output'], ['encrypt'])
  testEquivalent('combined stress', payloads.interpolation, ['randomize', 'encode', 'xorstrings', 'deadcode', 'controlflow', 'encrypt'])
  testEquivalent('parameter stress', payloads['named function parameters'], ['randomize', 'deadcode', 'controlflow'])
  testEquivalent('splatting stress', payloads.splatting, ['randomize', 'deadcode', 'controlflow'])
  testEquivalent('if else stress', payloads['if else adjacency'], ['deadcode', 'controlflow'])
  testEquivalent('do while stress', payloads['do while adjacency'], ['deadcode', 'controlflow'])
  testEquivalent('here string stress', payloads['here string stress'], ['randomize', 'deadcode', 'controlflow'])
}

const scriptParameters = `param([string]$Name, [int]$Count = 1)
1..$Count | ForEach-Object { "$Name-$_" }`
testEquivalent('splatting regression', payloads.splatting, ['randomize'])
testEquivalent('automatic variable regression', payloads['automatic PSBoundParameters'], ['randomize'])
testEquivalent('if else adjacency regression', payloads['if else adjacency'], ['deadcode', 'controlflow'])
testEquivalent('do while adjacency regression', payloads['do while adjacency'], ['deadcode', 'controlflow'])
testEquivalent('here string regression', payloads['here string stress'], ['randomize', 'deadcode', 'controlflow'])
testEquivalent('multiline hashtable and here-string regression', payloads['multiline hashtable and interpolating here string'], ['randomize', 'encode', 'xorstrings', 'deadcode', 'controlflow', 'encrypt'])
testEquivalent('escaped quote encoding regression', payloads['escaped double quote'], ['encode'])
testEquivalent('escaped quote XOR regression', payloads['escaped double quote'], ['xorstrings'])
testEquivalent('escaped interpolation regression', payloads['escaped interpolation'], ['randomize', 'encode', 'xorstrings'])
testEquivalent('script parameter default regression', payloads['script parameter default'], ['xorstrings', 'encrypt'])
testEquivalent('advanced function regression', payloads['advanced function'], ['randomize', 'encode', 'deadcode', 'controlflow', 'encrypt'])
testEquivalent('script parameters through wrapper', scriptParameters, ['encrypt'], ['-Name', 'Ilias', '-Count', '2'])
testEquivalent('combined script parameters through wrapper', scriptParameters, ['randomize', 'encode', 'deadcode', 'controlflow', 'encrypt'], ['-Name', 'Ilias', '-Count', '2'])
testEquivalent('positional args through wrapper', 'Write-Output ($args -join ",")', ['encrypt'], ['one', 'two'])
testEquivalent('using namespace with anti-analysis', payloads['using namespace'], ['antianalysis'])

// Do not write or execute the AMSI/ETW block: endpoint protection may quarantine it.
// This check only verifies that the engine composes the generated block with the payload.
const amsiSource = 'Write-Output "AMSI generation test"'
const amsiGenerated = normalize(obfuscatePowerShell(amsiSource, ['amsietw']))
if (typeof amsiGenerated === 'string' && amsiGenerated.includes(amsiSource) && amsiGenerated.length > amsiSource.length) {
  passed++
} else {
  failures.push({ name: 'AMSI/ETW generation', layers: ['amsietw'], reason: 'payload not preserved in generated output' })
}

const total = passed + failures.length + skipped
console.log(JSON.stringify({
  runtime: runtimeInfo.runtime,
  version: runtimeInfo.version,
  total,
  passed,
  failed: failures.length,
  skipped,
  failures,
}, null, 2))

process.exit(failures.length > 0 ? 1 : 0)
