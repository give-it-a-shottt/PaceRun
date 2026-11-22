import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** 아래에서 올라오는 시트. 바깥(어두운 부분)을 누르거나 뒤로 가기로 닫는다. */
export function BottomSheet({ visible, title, onClose, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgDimWeak }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.bgElevated, paddingBottom: Math.max(insets.bottom, space[6]) },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          <AppText variant="headline20SB" accessibilityRole="header">
            {title}
          </AppText>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[3],
    gap: space[4],
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full },
});
