import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Optimized for Replit Networking on Port 5000
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: 'all',
    hmr: {
      clientPort: 443 // Forces secure HMR through Replit's proxy
    }
  }
})

