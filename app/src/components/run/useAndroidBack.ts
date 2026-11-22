import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * 이 화면이 보이는 동안 안드로이드 뒤로 가기를 가로챈다.
 * onBack을 주지 않으면 아무 일도 하지 않고 막기만 한다(러닝 중 화면).
 */
export function useAndroidBack(onBack?: () => void) {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack?.();
        return true;
      });
      return () => subscription.remove();
    }, [onBack]),
  );
}
