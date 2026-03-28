import { execSync } from 'child_process'
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')
const tmpDir = resolve(root, '..', '_ghpages_tmp')

// Clean tmp
if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
mkdirSync(tmpDir, { recursive: true })

// Copy dist contents to tmp
cpSync(distDir, tmpDir, { recursive: true })

// Add CNAME
writeFileSync(resolve(tmpDir, 'CNAME'), 'payload-obfuscator.dev')

// Add .nojekyll (skip Jekyll processing)
writeFileSync(resolve(tmpDir, '.nojekyll'), '')

// Init git in tmp and push to gh-pages
const run = (cmd) => execSync(cmd, { cwd: tmpDir, stdio: 'inherit' })

run('git init')
run('git checkout -b gh-pages')
run('git add -A')
run('git commit -m "deploy: GitHub Pages"')
run('git remote add origin https://github.com/Ilias1988/payload-obfuscator.git')
run('git push origin gh-pages --force')

// Cleanup
rmSync(tmpDir, { recursive: true })
console.log('✅ Deployed to gh-pages!')
