import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, shadow, space } from '@/theme/tokens';

/** 설정 값을 고치는 시트들이 함께 받는 값 */
export type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type Props = SettingsSheetProps & {
  title: string;
  children: ReactNode;
  /**
   * 맨 아래에 [완료] 버튼을 둔다. 여러 번 눌러 고치는 시트(− / +, 알림 시간)에 쓴다.
   * 값은 바꾸는 순간 이미 저장되므로 이 버튼은 시트를 닫기만 한다.
   */
  doneButton?: boolean;
};

/** 설정 값을 고치는 시트의 틀. 바꾸면 바로 저장하므로 [저장] 버튼이 없다. */
export function SettingsSheet({ visible, title, onClose, children, doneButton }: Props) {
  const toast = useToastStore((s) => s.message);

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      // 앱 토스트는 시트(Modal) 뒤에 가려진다. 시트가 열린 동안의 안내(저장 실패)는 시트 위에 한 번 더 그린다.
      floating={toast ? <SheetToast message={toast} /> : null}
      footer={doneButton ? <Button label="완료" onPress={onClose} /> : undefined}>
      {children}
    </BottomSheet>
  );
}

/** 앱 토스트와 같은 모양. 읽어 주기와 3초 뒤 내리기는 앱 토스트(ToastHost)가 이미 한다. */
function SheetToast({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toast, { backgroundColor: colors.bgInverse, boxShadow: shadow.toast }]}>
      <AppText variant="body14M" color="textInverse">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.button,
  },
});
