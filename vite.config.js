import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    // This allows the specific Replit host to connect
    allowedHosts: true, 
    hmr: {
      clientPort: 443 
    }
  }
})

