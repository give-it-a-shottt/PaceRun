import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CaretDownIcon, CaretRightIcon } from '@/components/icons';
import { ReminderFields } from '@/components/ReminderFields';
import { reminderSummaryText, type ReminderChoice } from '@/domain/settingsView';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

type Props = {
  value: ReminderChoice;
  onChange: (next: ReminderChoice) => void;
};

const ROW_HEIGHT = 56;

/**
 * 알림 시간 줄. 줄을 누르면 아래에 켜기/끄기와 시 · 분을 고르는 칸이 펼쳐진다.
 * (피그마에는 줄만 있고 시각 선택용 패키지가 없어서, 펼친 모양은 시작 전 설정의 목표값 칸과 같게 만들었다.)
 */
export function ReminderTimePicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const summary = reminderSummaryText(value);
  const Caret = open ? CaretDownIcon : CaretRightIcon;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`알림 시간, ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}>
        <AppText variant="body16R" style={styles.rowTitle}>
          알림 시간
        </AppText>
        <AppText variant="body15R" color="textSub" numberOfLines={1}>
          {summary}
        </AppText>
        <Caret size={20} color={colors.iconSub} />
      </Pressable>
      {open ? <ReminderFields value={value} onChange={onChange} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowTitle: { flex: 1 },
});
