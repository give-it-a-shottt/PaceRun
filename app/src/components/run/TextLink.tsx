import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { space } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  /** 배너 안의 작은 링크는 caption12SB, 버튼 아래의 보조 행동은 body14M */
  variant?: 'body14M' | 'caption12SB';
};

/** 밑줄 글자 링크. 주 버튼 옆에 두는 가벼운 보조 행동에 쓴다. */
export function TextLink({ label, onPress, variant = 'body14M' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      // 글자만으로는 누르는 영역이 작아서 위아래로 넓힌다
      hitSlop={space[3]}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <AppText variant={variant} style={styles.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
