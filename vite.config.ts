import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      // Allow serving files from the parent repo's node_modules (needed for git worktrees)
      allow: ['.', path.resolve(__dirname, '../../..')],
    },
  },
})
