import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serve l'app in /mistercana/, Vercel dalla radice del dominio
  base: process.env.VERCEL ? '/' : '/mistercana/',
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
