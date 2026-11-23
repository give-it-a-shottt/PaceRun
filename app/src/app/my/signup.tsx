import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConnectLayout, SwitchLine } from '@/components/account/ConnectLayout';
import { useConnectForm } from '@/components/account/useConnectForm';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InfoIcon } from '@/components/icons';
import { ErrorNote, TextField, type TextFieldRef } from '@/components/TextField';
import { PASSWORD_MIN_LENGTH } from '@/domain/authForm';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

const INFO_ICON_SIZE = 16;

/** MY_01_004 회원가입. 가입하면 바로 로그인된 상태가 되고 동기화 상태 화면으로 간다. */
export default function SignupScreen() {
  const { colors } = useTheme();
  const { form, errors, submitting, change, submit, goBack, switchTo } = useConnectForm('signup');
  const passwordRef = useRef<TextFieldRef>(null);
  const confirmRef = useRef<TextFieldRef>(null);

  return (
    <ConnectLayout
      title="회원가입"
      onBack={goBack}
      gap={space[5]}
      footer={
        <>
          {errors.form ? <ErrorNote message={errors.form} /> : null}
          <Button label="가입하고 연결하기" loading={submitting} onPress={() => void submit()} />
          <SwitchLine text="이미 계정이 있어요" label="로그인" onPress={() => switchTo('/my/login')} />
        </>
      }>
      <AppText variant="headline24SB" accessibilityRole="header">
        가입하고 기록 연결하기
      </AppText>

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
        autoComplete="new-password"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="비밀번호 확인"
        placeholder="한 번 더 입력해 주세요"
        value={form.confirm}
        onChangeText={(value) => change('confirm', value)}
        error={errors.confirm}
        editable={!submitting}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />

      <View style={styles.info}>
        <InfoIcon size={INFO_ICON_SIZE} color={colors.iconSub} />
        <AppText variant="caption12R" color="textSub" style={styles.flex}>
          비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이에요. 비밀번호 찾기는 아직 지원하지 않아요.
        </AppText>
      </View>
    </ConnectLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
});
