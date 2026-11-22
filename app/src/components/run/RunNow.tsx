import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { IconProps } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

type Props = {
  label: string;
  /** 라벨 앞 아이콘(일시정지됨). */
  icon?: ComponentType<IconProps>;
  value: string;
  secondary: string;
};

/** 큰 숫자 묶음(C-6): 라벨 18 · 숫자 56 · 다음 줄 20. 화면에서 숫자는 이것 하나만 크게 둔다. */
export function RunNow({ label, icon: Icon, value, secondary }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.now}>
      <View style={styles.head}>
        <View style={styles.label}>
          {Icon ? <Icon size={20} color={colors.iconMain} weight="fill" /> : null}
          <AppText variant="title18M">{label}</AppText>
        </View>
        <AppText variant="display56SB" tabular numberOfLines={1}>
          {value}
        </AppText>
      </View>
      <AppText variant="title20R" color="textSub">
        {secondary}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  now: { alignSelf: 'stretch', gap: space[5] },
  head: { gap: space[3] },
  label: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
