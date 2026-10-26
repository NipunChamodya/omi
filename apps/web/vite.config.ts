import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
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
