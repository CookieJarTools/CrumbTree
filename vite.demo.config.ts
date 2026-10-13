import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone browser preview of the renderer (no Electron), driven by mock data.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  server: { port: 5199, strictPort: true, open: false },
  build: {
    rollupOptions: {
      // Build the mock-driven demo entry, emitted as index.html for easy serving.
      input: resolve(__dirname, 'src/renderer/demo.html')
    }
  }
})
