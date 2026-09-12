/**
 * Bash semantic regression suite.
 *
 * Runs benign fixtures before and after obfuscation and requires identical
 * exit status, stdout, and stderr. On Windows it executes through Kali WSL.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { obfuscateBash } from '../src/engines/bash.js'

const script = (...lines) => lines.join('\n') + '\n'
const fixtures = [
  ['basic quoting', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'name="Ilias"',
    'message="hello world * ? [x]"', `printf 'Name=<%s> Message=<%s>\\n' "$name" "$message"`,
  )],
  ['arithmetic', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'total=2', 'step=3',
    'total=$((total + step))', '((total += step))', `printf '%d\\n' "$total"`,
  )],
  ['parameter expansion', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'name=""', 'fallback="Ilias"',
    "printf '%s|%s|%s\\n' \"${name:-default}\" \"${fallback^^}\" \"${#fallback}\"",
  )],
  ['arrays', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'items=("one item" "two" "τρία")',
    "printf '[%s]\\n' \"${items[@]}\"", "printf 'count=%d\\n' \"${#items[@]}\"",
  )],
  ['functions', script(
    '#!/usr/bin/env bash', 'set -euo pipefail',
    `add() { local left=$1 right=$2; printf '%d' "$((left + right))"; }`,
    'result=$(add 10 20)', `printf 'sum=%s\\n' "$result"`,
  )],
  ['loop and case', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'status=""', 'for value in 1 2 3; do',
    '  case "$value" in', '    1) status+="A" ;;', '    2) status+="B" ;;',
    '    *) status+="C" ;;', '  esac', 'done', `printf '%s\\n' "$status"`,
  )],
  ['multiline pipeline', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', `text=$(printf '%s\\n' alpha beta gamma |`,
    `  grep 'a' |`, `  tr '[:lower:]' '[:upper:]')`, `printf '%s\\n' "$text"`,
  )],
  ['nested substitution', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'word="world"',
    `result="prefix $(printf '%s' "$word") suffix"`, `printf '<%s>\\n' "$result"`,
  )],
  ['Unicode', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'message="Γειά σου 👋"', `printf '%s\\n' "$message"`,
  )],
  ['escaped strings', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'path="C:\\temp\\new"',
    'quote="say \\"hello\\""', `printf '%s|%s\\n' "$path" "$quote"`,
  )],
  ['unquoted heredoc', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'name="Ilias"', 'text=$(cat <<EOF',
    'hello $name', 'literal key=value', 'EOF', ')', `printf '%s\\n' "$text"`,
  )],
  ['quoted heredoc', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'name="Ilias"', "text=$(cat <<'EOF'",
    'hello $name', 'literal key=value', 'EOF', ')', `printf '%s\\n' "$text"`,
  )],
  ['CLI args', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'label=${1:-Ilias}', 'count=${2:-7}',
    `printf '%s:%d\\n' "$label" "$((count + 1))"`,
  ), ['Ilias', '7']],
  ['exported environment', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'export DEMO_VALUE="works"',
    `child=$(bash -c 'printf %s "$DEMO_VALUE"')`, `printf '%s\\n' "$child"`,
  )],
  ['positional and special parameters', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'label=$1', 'shift',
    `printf 'label=%s count=%d args=' "$label" "$#"`, `printf '<%s>' "$@"`, `printf '\\n'`,
  ), ['Ilias', 'one', 'two words']],
  ['associative arrays', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'declare -A colors=([sky]="blue light" [leaf]="green")',
    'key="sky"', "printf '%s|%d\\n' \"${colors[$key]}\" \"${#colors[@]}\"",
  )],
  ['associative array mutation', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'declare -A counts=([red]=0 [blue]=0)',
    'for key in red blue red; do', '  counts[$key]=$((counts[$key] + 1))', 'done',
    `printf 'red=%d blue=%d\\n' "\${counts[red]}" "\${counts[blue]}"`,
  )],
  ['process substitution', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'joined=""',
    "while IFS= read -r line; do joined+=\"${line^^};\"; done < <(printf '%s\\n' alpha beta)",
    `printf '%s\\n' "$joined"`,
  )],
  ['read and here-string', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'input="alpha beta"',
    'read -r first second <<< "$input"', `printf '%s|%s\\n' "$first" "$second"`,
  )],
  ['trap with dynamic string', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'cleanup_message="done"',
    `trap 'printf "trap=%s\\n" "$cleanup_message"' EXIT`, `printf 'body\\n'`,
  )],
  ['deep nested substitution', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'value="abc"',
    `result="outer $(printf '<%s>' "$(printf '%s' "$value")") end"`, `printf '%s\\n' "$result"`,
  )],
  ['advanced expansion', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'value="banana.txt"',
    "printf '%s|%s|%s|%s\\n' \"${value//a/A}\" \"${value:1:3}\" \"${value%.txt}\" \"${value#b}\"",
  )],
  ['nameref safe fallback', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'target="works"', 'reference_name="target"',
    'declare -n reference="$reference_name"', `printf '%s\\n' "$reference"`,
  )],
  ['existing for target', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'item="before"', 'result=""',
    'for item in one two; do result+="$item;"; done', `printf '%s|%s\\n' "$item" "$result"`,
  )],
  ['existing read targets', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'first="before"', 'second="before"',
    'read -r first second <<< "alpha beta"', `printf '%s|%s\\n' "$first" "$second"`,
  )],
  ['printf variable target', script(
    '#!/usr/bin/env bash', 'set -euo pipefail', 'output="before"',
    `printf -v output '%s:%d' "value" 7`, `printf '%s\\n' "$output"`,
  )],
]

const layerMatrix = [
  ['randomize'], ['encode'], ['xorstrings'], ['deadcode'], ['encrypt'],
  ['randomize', 'encode'], ['randomize', 'xorstrings'],
  ['randomize', 'encode', 'deadcode'],
  ['randomize', 'xorstrings', 'deadcode', 'encrypt'],
  ['randomize', 'encode', 'xorstrings', 'deadcode', 'encrypt'],
]

const isWindows = process.platform === 'win32'
const wslDistro = process.env.PAYLOAD_OBFUSCATOR_WSL_DISTRO || 'kali-linux'
const tempDir = mkdtempSync(join(tmpdir(), 'payload-obfuscator-bash-'))
let fileCounter = 0

function toWslPath(path) {
  return '/mnt/' + path[0].toLowerCase() + path.slice(2).replaceAll('\\', '/')
}

function bashProcessArgs(file, args) {
  if (!isWindows) return { command: 'bash', args: [file, ...args] }
  return {
    command: 'wsl.exe',
    args: ['-d', wslDistro, '--', 'env', 'LC_ALL=C.UTF-8', 'bash', toWslPath(file), ...args],
  }
}

function execute(code, args = []) {
  const file = join(tempDir, `case-${fileCounter++}.sh`)
  writeFileSync(file, code, 'utf8')
  const processArgs = bashProcessArgs(file, args)
  const result = spawnSync(processArgs.command, processArgs.args, { encoding: 'utf8', timeout: 20000 })
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error?.message || '',
  }
}

const versionProbe = isWindows
  ? spawnSync('wsl.exe', ['-d', wslDistro, '--', 'bash', '--version'], { encoding: 'utf8' })
  : spawnSync('bash', ['--version'], { encoding: 'utf8' })

if (versionProbe.status !== 0) {
  console.error(`Bash runtime unavailable: ${versionProbe.stderr || versionProbe.error?.message || ''}`)
  process.exit(1)
}

let total = 0
let passed = 0
const failures = []

function check(name, source, layers, args = []) {
  total++
  const expected = execute(source, args)
  if (expected.status !== 0) throw new Error(`Invalid fixture "${name}": ${expected.stderr || expected.error}`)

  let transformed
  try { transformed = obfuscateBash(source, layers) }
  catch (error) {
    failures.push({ name, layers, reason: `transform crashed: ${error.message}` })
    return
  }

  const actual = execute(transformed, args)
  if (expected.status === actual.status && expected.signal === actual.signal &&
      expected.stdout === actual.stdout && expected.stderr === actual.stderr) {
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
  for (const [name, source, args = []] of fixtures) {
    for (const layers of layerMatrix) {
      for (let iteration = 0; iteration < 2; iteration++) {
        check(`${name} #${iteration + 1}`, source, layers, args)
      }
    }
  }

  const basicSource = fixtures[0][1]
  for (const layers of [
    ['antianalysis'],
    ['xorstrings', 'antianalysis'],
    ['antianalysis', 'encrypt'],
    ['randomize', 'encode', 'xorstrings', 'deadcode', 'antianalysis', 'encrypt'],
  ]) {
    check('anti-analysis placement', basicSource, layers)
  }

  total++
  if (obfuscateBash('', ['encrypt']) === '') passed++
  else failures.push({ name: 'empty input', layers: ['encrypt'], reason: 'did not return an empty string' })

  total++
  if (obfuscateBash(basicSource, ['xorstrings']).startsWith('#!/usr/bin/env bash\n')) passed++
  else failures.push({ name: 'shebang preservation', layers: ['xorstrings'], reason: 'shebang is not the first line' })

  const version = (versionProbe.stdout || versionProbe.stderr).split(/\r?\n/)[0]
  console.log(`${version} — ${passed}/${total} semantic checks passed.`)
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure.name} [${failure.layers.join(', ')}]: ${failure.reason}`)
    }
    process.exitCode = 1
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
