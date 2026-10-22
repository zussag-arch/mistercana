import { defineConfig } from 'vite'

export default defineConfig({
  base: '/mistercana/',
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
