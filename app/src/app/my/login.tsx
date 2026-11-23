import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConnectLayout, SwitchLine } from '@/components/account/ConnectLayout';
import { useConnectForm } from '@/components/account/useConnectForm';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorNote, TextField, type TextFieldRef } from '@/components/TextField';
import { loginIntro } from '@/domain/syncView';
import { useAuthStore } from '@/state/authStore';
import { space } from '@/theme/tokens';

/** MY_01_003 로그인. 성공하면 기록 올리기 · 내려받기가 시작되고 동기화 상태 화면으로 간다. */
export default function LoginScreen() {
  // 만료된 뒤 다시 로그인하러 왔으면 쓰던 이메일을 채워서 연다
  const savedEmail = useAuthStore((s) => s.email);
  const localOnlyCount = useAuthStore((s) => s.localOnlyCount);
  const { form, errors, submitting, change, submit, goBack, switchTo } = useConnectForm('login', savedEmail ?? '');
  const passwordRef = useRef<TextFieldRef>(null);

  return (
    <ConnectLayout
      title="계정 연결"
      onBack={goBack}
      gap={space[6]}
      footer={
        <>
          {errors.form ? <ErrorNote message={errors.form} /> : null}
          <Button label="로그인" loading={submitting} onPress={() => void submit()} />
          <SwitchLine text="처음이에요" label="회원가입" onPress={() => switchTo('/my/signup')} />
        </>
      }>
      <View style={styles.heading}>
        <AppText variant="headline24SB" accessibilityRole="header">
          로그인
        </AppText>
        <AppText color="textSub">{loginIntro(localOnlyCount)}</AppText>
      </View>

      <TextField
        label="이메일"
        value={form.email}
        onChangeText={(value) => change('email', value)}
        error={errors.email}
        editable={!submitting}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        // 키보드를 내리지 않고 다음 칸으로 넘긴다
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="비밀번호"
        value={form.password}
        onChangeText={(value) => change('password', value)}
        error={errors.password}
        editable={!submitting}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
    </ConnectLayout>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space[2] },
});
