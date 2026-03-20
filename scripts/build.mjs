import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Change CWD so Tailwind & PostCSS resolve configs correctly
process.chdir(root)

const { build } = await import('../node_modules/vite/dist/node/index.js')

await build({
  root,
  configFile: resolve(root, 'vite.config.js'),
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
