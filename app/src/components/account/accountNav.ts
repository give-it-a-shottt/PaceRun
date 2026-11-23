import { router } from 'expo-router';

/** 계정 화면(동기화 상태 · 로그인 · 회원가입)의 뒤로 가기. 주소로 바로 들어와 돌아갈 화면이 없으면 내 정보 탭으로 간다. */
export function leaveAccountScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/my');
}

/** 로그인 화면으로(계정 연결 · 다시 로그인) */
export function openLogin() {
  router.navigate('/my/login');
}
