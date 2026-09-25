import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Evita instancias duplicadas durante la recarga en caliente de componentes lazy.
  resolve: { dedupe: ['react', 'react-dom'] },
})
