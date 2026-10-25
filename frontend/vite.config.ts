import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Evita instancias duplicadas durante la recarga en caliente de componentes lazy.
  resolve: { dedupe: ['react', 'react-dom'] },
  // CONFIGURACIÓN PARA EL SERVIDOR LOCAL Y LA RED:
  server: {
    host: true, // Expone el proyecto automáticamente a la red local (0.0.0.0)
    port: 5173  // Asegura que siempre use el puerto 5173
  }
})
