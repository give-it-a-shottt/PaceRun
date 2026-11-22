import { AppState } from 'react-native';

/** 앱이 지금 화면에 보이는지. 화면이 꺼져 있거나 다른 앱 뒤에 있으면 false */
export function isAppVisible(): boolean {
  return AppState.currentState === 'active';
}
