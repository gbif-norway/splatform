import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** First npm package name inside node_modules (handles @scope/pkg). */
function npmPackageName(id: string): string | null {
  const normalized = id.replace(/\\/g, '/')
  const m = normalized.match(/node_modules\/((?:@[^/]+\/[^/]+|[^/]+))/)
  return m ? m[1] : null
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/splatform/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkg = npmPackageName(id)
          if (!pkg) return undefined

          // React + scheduler must share one chunk or Rollup reports:
          // "Circular chunk: vendor -> vendor-react -> vendor" (react imports scheduler).
          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') {
            return 'vendor-react'
          }

          // Large optional feature; keep out of the main vendor blob.
          if (pkg === 'exceljs') {
            return 'vendor-exceljs'
          }

          if (pkg === 'lucide-react') {
            return 'vendor-lucide'
          }

          if (pkg === 'html5-qrcode') {
            return 'vendor-qrcode'
          }

          // utif depends on pako; keep both together to avoid vendor <-> vendor-utif cycles.
          if (pkg === 'utif' || pkg === 'pako') {
            return 'vendor-utif'
          }

          return 'vendor'
        },
      },
    },
    // exceljs alone is ~0.9MB minified; acceptable as a lazy-loaded export chunk.
    chunkSizeWarningLimit: 1024,
  },
})
