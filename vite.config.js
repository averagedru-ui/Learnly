import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Mandatory for Replit
    port: 5000,      // The port Replit looks for
    strictPort: true,
    allowedHosts: 'all' 
  }
})

