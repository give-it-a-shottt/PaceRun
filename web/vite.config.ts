import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/** 개발 중 API 서버(내 PC). 다른 곳에 띄웠으면 VITE_DEV_API_TARGET으로 바꾼다. */
const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 브라우저는 이 사이트와 같은 주소(/api)로 보내고 vite가 API 서버로 넘겨 준다.
    // 주소가 같아야 리프레시 토큰 쿠키(SameSite=Lax)가 갱신 요청에 실리고, CORS 설정도 필요 없다.
    proxy: {
      '/api': { target: DEV_API_TARGET, changeOrigin: false },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
