import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/splatform/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('html5-qrcode')) {
              return 'vendor-qrcode';
            }
            if (id.includes('utif')) {
              return 'vendor-utif';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
