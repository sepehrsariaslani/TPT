import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    // لازم برای پیش‌نمایش روی دامنه سندباکس
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
