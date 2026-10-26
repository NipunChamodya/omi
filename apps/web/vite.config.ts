import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { pwa } from './pwa';
import { frontendSecurity } from './security';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), [
    'API_PROXY_',
    'VITE_API_URL',
  ]);
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [
      react(),
      pwa(),
      tailwindcss(),
      frontendSecurity(
        command === 'serve' && !isPreview,
        process.env.VITE_API_URL ?? env.VITE_API_URL,
      ),
    ],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target:
            process.env.API_PROXY_TARGET ??
            env.API_PROXY_TARGET ??
            'http://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
