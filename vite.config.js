import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/lab304/',
  define: {
    'import.meta.env.VITE_APP_BUILD_VERSION': JSON.stringify(
      `${pkg.version}-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`
    ),
  },
})
