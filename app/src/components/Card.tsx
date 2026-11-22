import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

/** 그림자 없이 선으로 구분하는 카드(pacerun-design.md 3장 Card). */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.bgDefault,
          borderColor: colors.lineRegular,
          borderWidth: 1,
          borderRadius: radius.card,
          padding: space[5],
          gap: space[2],
        },
        style,
      ]}
    />
  );
}
