import { create } from 'zustand';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

const TOAST_DURATION_MS = 3000;

type ToastState = {
  message: string | null;
  /** 같은 문구를 연달아 띄워도 타이머가 다시 돌도록 구분하는 번호 */
  seq: number;
  show: (message: string) => void;
  hide: () => void;
};

const useToastStore = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));

/** 어디서든 부를 수 있는 토스트(3초). 예: `showToast('GPS 신호를 찾는 중')` */
export function showToast(message: string) {
  useToastStore.getState().show(message);
}

/** 루트 레이아웃에 한 번만 둔다. */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(hide, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, seq, hide]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
      <View style={[styles.toast, { backgroundColor: colors.bgInverse }]}>
        <AppText variant="body14M" color="textInverse">
          {message}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space[5] },
  toast: { paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.button },
});
