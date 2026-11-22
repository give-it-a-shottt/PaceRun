import { Redirect } from 'expo-router';

/** 앱의 첫 주소. 지금은 홈으로 보낸다(첫 실행이면 온보딩으로 보내는 분기는 F-004에서 추가). */
export default function Index() {
  return <Redirect href="/home" />;
}
