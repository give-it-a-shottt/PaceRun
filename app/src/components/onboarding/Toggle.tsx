import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius } from '@/theme/tokens';

// 피그마 Toggle(6:74): 52×32, 손잡이 지름 24
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const KNOB_SIZE = 24;
const KNOB_INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2;
/** 보이는 높이는 32지만 누르는 영역은 44가 되게 위아래로 넓힌다 */
const HIT_SLOP = 6;

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  /** 화면을 읽어 주는 기능이 말할 이름 */
  label: string;
};

/** 켜고 끄는 스위치. 꺼짐은 색만이 아니라 손잡이 위치로도 구분된다. */
export function Toggle({ value, onChange, label }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={HIT_SLOP}
      onPress={() => onChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.primaryDefault : colors.iconSub }]}>
      <View
        style={[styles.knob, { backgroundColor: colors.iconOnPrimary }, value ? styles.knobOn : styles.knobOff]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: radius.full },
  knob: { position: 'absolute', top: KNOB_INSET, width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: radius.full },
  knobOn: { right: KNOB_INSET },
  knobOff: { left: KNOB_INSET },
});
