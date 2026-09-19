import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// uTools 以 file:// 加载插件页，必须相对路径 base
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
