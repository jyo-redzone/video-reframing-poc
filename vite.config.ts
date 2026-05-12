import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/video-reframing-poc/",
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    passWithNoTests: true,
  },
})
