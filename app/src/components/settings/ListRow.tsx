import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CaretRightIcon } from '@/components/icons';
import { Toggle } from '@/components/Toggle';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

const ROW_HEIGHT = 56;
const CARET_SIZE = 20;

type Props =
  /** 지금 값을 보여 주고, 누르면 그 값을 고치는 곳이 열린다 */
  | { type: 'value'; title: string; value: string; onPress: () => void }
  /** 그 자리에서 켜고 끈다 */
  | { type: 'toggle'; title: string; value: boolean; onChange: (next: boolean) => void }
  /** 다른 곳(폰 설정 등)으로 보낸다 */
  | { type: 'link'; title: string; onPress: () => void };

/** 설정 행 56 (피그마 List Row 6:109): Value / Toggle / Link */
export function ListRow(props: Props) {
  const { colors } = useTheme();

  if (props.type === 'toggle') {
    return (
      <View style={styles.row}>
        <AppText variant="body16R" style={styles.title}>
          {props.title}
        </AppText>
        <Toggle label={props.title} value={props.value} onChange={props.onChange} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.type === 'value' ? `${props.title}, ${props.value}` : props.title}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppText variant="body16R" style={styles.title}>
        {props.title}
      </AppText>
      {props.type === 'value' ? (
        <AppText variant="body15R" color="textSub" numberOfLines={1}>
          {props.value}
        </AppText>
      ) : null}
      <CaretRightIcon size={CARET_SIZE} color={colors.iconSub} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flex: 1 },
  pressed: { opacity: 0.6 },
});
