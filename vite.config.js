import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const upstream = String(env.APPS_SCRIPT_URL || '').trim()
  const viteGas = String(env.VITE_APPS_SCRIPT_URL || '').trim()
  let proxy
  if (viteGas === '/api/gas' && /^https:\/\/script\.google\.com\//i.test(upstream)) {
    try {
      const u = new URL(upstream)
      proxy = {
        '/api/gas': {
          target: `${u.protocol}//${u.host}`,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => {
            const q = path.includes('?') ? path.slice(path.indexOf('?')) : ''
            return u.pathname + q
          },
        },
      }
    } catch {
      /* ignore */
    }
  }
  return {
    plugins: [react()],
    server: proxy ? { proxy } : {},
  }
})
