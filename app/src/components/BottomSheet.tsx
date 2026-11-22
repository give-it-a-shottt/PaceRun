import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import { layout, radius, shadow, space } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 시트 맨 아래에 붙어 있는 영역(주 버튼). 내용이 길어 스크롤돼도 항상 보인다. */
  footer?: ReactNode;
  /**
   * 시트 바로 위에 띄우는 안내(토스트 모양).
   * 앱 토스트는 Modal 뒤에 가려지므로, 시트가 열려 있는 동안의 안내는 시트가 직접 그린다.
   */
  floating?: ReactNode;
};

/** 아래에서 올라오는 시트. 바깥(어두운 부분)을 누르거나 뒤로 가기로 닫는다. */
export function BottomSheet({ visible, title, onClose, children, footer, floating }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + space[4] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgDimWeak }]}
        />
        {floating ? (
          <View pointerEvents="box-none" style={styles.floating}>
            {floating}
          </View>
        ) : null}
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgElevated,
              boxShadow: shadow.elevated,
              paddingBottom: Math.max(insets.bottom, layout.bottomSafePadding),
            },
          ]}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          </View>
          <AppText variant="title18SB" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {/* 내용이 화면보다 길면 이 부분만 스크롤된다 */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  floating: { paddingHorizontal: layout.screenPaddingX, paddingBottom: space[4] },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  handleArea: { height: space[5], alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: radius.full },
  title: { paddingTop: space[2], paddingHorizontal: layout.screenPaddingX },
  scroll: { flexGrow: 0 },
  content: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX, gap: space[4] },
  footer: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX, gap: space[2] },
});
