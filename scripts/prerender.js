/**
 * Post-build Pre-rendering Script
 * After Vite builds the app into dist/, this script:
 * 1. Starts a local static server serving dist/
 * 2. Opens the page with Puppeteer (headless Chrome)
 * 3. Waits for React to fully render
 * 4. Captures the rendered HTML (including Helmet <head> tags)
 * 5. Writes it back to dist/index.html
 */

import { createServer } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, join, extname } from 'path'
import puppeteer from 'puppeteer'

const DIST_DIR = resolve(process.cwd(), 'dist')
const PORT = 4173
const URL = `http://localhost:${PORT}/`

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function startServer() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url)

      try {
        const content = readFileSync(filePath)
        const ext = extname(filePath)
        const mime = MIME_TYPES[ext] || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': mime })
        res.end(content)
      } catch {
        try {
          const fallback = readFileSync(join(DIST_DIR, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(fallback)
        } catch {
          res.writeHead(404)
          res.end('Not found')
        }
      }
    })

    server.listen(PORT, () => {
      console.log(`  📦 Static server running at ${URL}`)
      resolvePromise(server)
    })
  })
}

async function prerender() {
  console.log('\n🚀 Pre-rendering started...\n')

  const server = await startServer()

  try {
    console.log('  🌐 Launching headless browser...')
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    console.log('  ⏳ Loading page and waiting for React to render...')
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })

    // Give React time to hydrate and Helmet to inject head tags
    await new Promise((r) => setTimeout(r, 2000))

    const renderedHTML = await page.content()

    await browser.close()
    console.log('  ✅ Page rendered successfully!')

    const outputPath = join(DIST_DIR, 'index.html')
    writeFileSync(outputPath, renderedHTML, 'utf-8')
    console.log(`  💾 Pre-rendered HTML saved to: dist/index.html`)

    // Verify
    const savedHTML = readFileSync(outputPath, 'utf-8')
    const rootMatch = savedHTML.match(/<div id="root">([\s\S]*?)<\/div>/)

    if (rootMatch && rootMatch[1].trim().length > 0) {
      const contentLength = rootMatch[1].trim().length
      console.log(`  🎯 Success! <div id="root"> contains ${contentLength} characters of pre-rendered content`)
    } else {
      console.warn('  ⚠️  Warning: <div id="root"> appears empty.')
    }

    if (savedHTML.includes('application/ld+json')) {
      console.log('  📊 JSON-LD structured data found in rendered HTML')
    }

    if (savedHTML.includes('Advanced Evasion Techniques')) {
      console.log('  📝 SEO educational content found in rendered HTML')
    }

  } finally {
    server.close()
  }

  console.log('\n✨ Pre-rendering complete!\n')
}

prerender().catch((err) => {
  console.error('❌ Pre-rendering failed:', err)
  process.exit(1)
})
