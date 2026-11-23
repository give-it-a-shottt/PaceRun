import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { TextLink } from '@/components/run/TextLink';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { layout, space } from '@/theme/tokens';

type Props = {
  /** 상단 바 제목 */
  title: string;
  onBack: () => void;
  /** 내용 사이 간격(피그마: 로그인 24, 회원가입 20) */
  gap: number;
  children: ReactNode;
  /** 아래에 붙는 영역: 오류 문구 · 주 버튼 · 다른 화면으로 가는 글자 버튼 */
  footer: ReactNode;
};

/** 로그인 · 회원가입 화면의 틀: 상단 뒤로 가기, 스크롤되는 입력 영역, 아래에 붙은 버튼 영역. */
export function ConnectLayout({ title, onBack, gap, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  // 제스처 바는 34로 충분하지만, 3버튼 내비게이션 바는 더 높아서 버튼이 가려지지 않게 넓힌다
  const paddingBottom = Math.max(layout.bottomSafePadding, insets.bottom + space[2]);

  return (
    <Screen>
      {/*
        키보드가 올라오면 그 높이만큼 아래를 비워 버튼과 입력창이 가려지지 않게 한다.
        KeyboardAvoidingView는 자기 위치를 부모(Screen의 상태 바 여백 안쪽) 기준으로 재서
        상태 바 높이만큼 덜 비우므로 그만큼 보탠다.
      */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top} style={styles.flex}>
        <TopBar variant="back" title={title} onBack={onBack} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { gap }]}
          // 키보드가 올라온 채로 버튼을 눌러도 한 번에 눌리게 한다
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom }]}>{footer}</View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** 주 버튼 아래의 한 줄: 안내 글자 + 다른 화면으로 가는 글자 버튼("처음이에요 회원가입") */
export function SwitchLine({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  return (
    <View style={styles.switchLine}>
      <AppText variant="body14R" color="textSub">
        {text}
      </AppText>
      <TextLink label={label} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: space[4],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[4],
  },
  footer: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  switchLine: { flexDirection: 'row', justifyContent: 'center', gap: space[2] },
});
