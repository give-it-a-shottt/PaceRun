import { Modal, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, shadow, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';

type Action = { label: string; onPress: () => void; variant?: ButtonVariant };

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  /** 주 행동을 먼저 둔다. 최대 2개. 화면에는 보조(왼쪽) · 주(오른쪽) 순서로 나란히 놓인다. */
  actions: [Action] | [Action, Action];
  /** 안드로이드 뒤로 가기를 눌렀을 때. 없으면 뒤로 가기로 닫히지 않는다. */
  onRequestClose?: () => void;
};

/** 가운데 뜨는 확인 창(권한 없음 · 강제 종료 복구 · 10분 전 종료 · 덮어쓰기 확인). */
export function AlertDialog({ visible, title, message, actions, onRequestClose }: Props) {
  const { colors } = useTheme();
  const [primary, secondary] = actions;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: colors.bgDim }]}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.box, { backgroundColor: colors.bgElevated, boxShadow: shadow.elevated }]}>
          <View style={styles.text}>
            <AppText variant="title18SB">{title}</AppText>
            {message ? (
              <AppText variant="body15R" color="textSub">
                {message}
              </AppText>
            ) : null}
          </View>
          <View style={styles.actions}>
            {secondary ? (
              <Button
                label={secondary.label}
                onPress={secondary.onPress}
                variant={secondary.variant ?? 'outlineStrong'}
                style={styles.action}
              />
            ) : null}
            <Button
              label={primary.label}
              onPress={primary.onPress}
              variant={primary.variant ?? 'primary'}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[8] },
  box: {
    alignSelf: 'stretch',
    borderRadius: radius.modal,
    paddingTop: space[6],
    paddingHorizontal: space[5],
    paddingBottom: space[5],
    gap: space[6],
  },
  text: { gap: space[2] },
  actions: { flexDirection: 'row', gap: space[2] },
  action: { flex: 1 },
});
