import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, space, typography } from '@/theme/tokens';

import { AppText } from './AppText';
import { WarningIcon } from './icons';

const FIELD_HEIGHT = 48;
const HELPER_ICON_SIZE = 16;
const FOCUS_BORDER = 2;
const ERROR_BORDER = 1;
// 입력창에 줄 높이를 주면 안드로이드에서 글자와 커서가 세로로 어긋날 수 있어 뺀다(높이 48 안에서 가운데로 놓인다)
const { lineHeight: _lineHeight, ...INPUT_FONT } = typography.body15R;

export type TextFieldRef = ComponentRef<typeof TextInput>;

type Props = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  /** 입력창 위에 항상 보이는 이름 */
  label: string;
  /** 오류 문구. 있으면 테두리 색과 함께 입력창 아래에 글자로 보여 준다. */
  error?: string;
  ref?: Ref<TextFieldRef>;
};

/** 오류 한 줄: 경고 아이콘 + 글자(색만으로 알리지 않는다). 나타나면 화면 읽기가 읽어 준다. */
export function ErrorNote({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.helper}>
      <WarningIcon size={HELPER_ICON_SIZE} color={colors.statusErrorBase} />
      <AppText variant="caption12R" color="statusErrorText" style={styles.flex}>
        {message}
      </AppText>
    </View>
  );
}

/** 입력창 48 (피그마 Input 6:95): 이름은 항상 위, 누르면 검은 테두리 2, 오류면 빨간 테두리 + 아이콘 + 문구. */
export function TextField({ label, error, ref, onFocus, onBlur, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderWidth = focused ? FOCUS_BORDER : error ? ERROR_BORDER : 0;
  const borderColor = focused ? colors.lineBlack : colors.statusErrorBase;

  return (
    <View style={styles.wrap}>
      {/* 이름은 입력창의 accessibilityLabel로 읽히므로 따로 읽지 않게 한다 */}
      <AppText variant="caption13M" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </AppText>
      <TextInput
        {...rest}
        ref={ref}
        accessibilityLabel={error ? `${label}, ${error}` : label}
        placeholderTextColor={colors.textSub}
        cursorColor={colors.textMain}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.field,
          INPUT_FONT,
          {
            color: colors.textMain,
            backgroundColor: colors.bgRegular,
            borderColor,
            borderWidth,
            // 테두리 두께만큼 안쪽 여백을 줄여 테두리가 생겨도 글자가 옆으로 밀리지 않게 한다
            paddingHorizontal: space[4] - borderWidth,
          },
        ]}
      />
      {error ? <ErrorNote message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space[2] },
  field: { height: FIELD_HEIGHT, borderRadius: radius.input, paddingVertical: 0 },
  helper: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1] },
});
