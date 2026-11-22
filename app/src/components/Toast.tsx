import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeContext';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

const TOAST_DURATION_MS = 3000;
/** 하단 Dock Bar(탭 56 + 안전 영역)나 하단 버튼에 가리지 않게 띄우는 높이 */
const TOAST_BOTTOM_OFFSET = layout.dockTabHeight + layout.bottomSafePadding + space[1.5];

/** 토스트를 실제로 그리는 곳. 루트 레이아웃에 한 번만 둔다. 띄울 때는 `showToast`를 쓴다. */
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
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + TOAST_BOTTOM_OFFSET }]}>
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
