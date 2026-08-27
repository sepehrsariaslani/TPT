import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * خطاهای مرورگر را به کنسول سرور می‌فرستد تا دیباگ از راه دور ممکن باشد.
 * فقط در حالت توسعه/پیش‌نمایش فعال است.
 */
function clientLogPlugin() {
  const handler = (req, res, next) => {
    if (!req.url.startsWith('/__client-log')) return next();
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const tag = data.type === 'webgl-ready' ? '\x1b[32m[client ✔]\x1b[0m' : '\x1b[31m[client ✖]\x1b[0m';
        console.log(tag, JSON.stringify(data, null, 1));
      } catch (e) {
        console.log('[client] raw:', body.slice(0, 400));
      }
      res.statusCode = 204;
      res.end();
    });
  };

  return {
    name: 'tpt-client-log',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  plugins: [react(), clientLogPlugin()],
  resolve: {
    // جلوگیری از لود شدن دو نسخه مجزا از three/fiber که باعث خطای
    // «Hooks can only be used within the Canvas» و سفید شدن صفحه می‌شود
    dedupe: ['three', 'react', 'react-dom', '@react-three/fiber', '@react-three/drei'],
  },
  optimizeDeps: {
    include: [
      'three',
      'react',
      'react-dom',
      'react-dom/client',
      '@react-three/fiber',
      '@react-three/postprocessing',
      'postprocessing',
    ],
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    // لازم برای پیش‌نمایش روی دامنه سندباکس
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
