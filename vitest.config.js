import { defineConfig } from 'vite';

export default defineConfig({
  // Vitest 配置沿用 vite 配置（内嵌在 package.json 的 test 字段之外，保持简单）
  test: {
    environment: 'node',
    include: ['tests/**/*.test.mjs'],
  },
});
