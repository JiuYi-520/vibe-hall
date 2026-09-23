import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: false },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        // 依赖分包：路由按需加载后，vendor 各自独立缓存，改业务代码不会让依赖缓存失效
        manualChunks(id) {
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run')) return 'router'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react'
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.mjs'],
    css: false,
  },
})
