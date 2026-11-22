import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 단위 테스트는 React Native를 불러오지 않는 순수 로직(src/domain 등)만 대상으로 한다.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
