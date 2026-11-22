import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { typography, type ColorName, type TypographyName } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypographyName;
  color?: ColorName;
  /** 실시간으로 바뀌는 숫자는 자릿수 폭을 고정해 흔들리지 않게 한다. */
  tabular?: boolean;
};

export function AppText({ variant = 'body15R', color = 'textMain', tabular, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
