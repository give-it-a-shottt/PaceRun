import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAndroidBack } from '@/components/run/useAndroidBack';
import type { AuthFormErrors, AuthMode } from '@/domain/authForm';
import { connectAccount } from '@/services/account';

import { leaveAccountScreen } from './accountNav';

export type ConnectField = 'email' | 'password' | 'confirm';

/**
 * 로그인 · 회원가입 화면의 입력값, 오류 문구, 보내기.
 * 입력 확인과 서버 통신은 connectAccount가 한다. 여기서는 그 결과를 칸에 나눠 보여 주고 화면을 옮긴다.
 */
export function useConnectForm(mode: AuthMode, initialEmail = '') {
  const [form, setForm] = useState<Record<ConnectField, string>>(() => ({
    email: initialEmail,
    password: '',
    confirm: '',
  }));
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // 버튼이 로딩으로 바뀌기 전에 한 번 더 눌려도 두 번 보내지 않게 한다
  const submittingRef = useRef(false);

  const change = (field: ConnectField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      // 고친 칸의 오류와, 칸을 고치면 더는 맞지 않는 오류(틀린 조합 · 연결 실패)를 지운다
      const next = { ...current };
      delete next[field];
      delete next.form;
      // "비밀번호가 서로 달라요"는 비밀번호를 고쳐도 풀릴 수 있다
      if (field === 'password') delete next.confirm;
      return next;
    });
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const failed = await connectAccount(
      mode,
      mode === 'signup' ? form : { email: form.email, password: form.password },
    );
    if (failed) {
      setErrors(failed);
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }
    // 동기화 상태 화면이 아래에 있으면 거기까지 닫고, 없으면(내 정보 탭에서 바로 옴) 이 화면을 그 화면으로 바꾼다.
    // 어느 쪽이든 거기서 뒤로 가면 내 정보 탭이다. 화면이 넘어가는 사이에 다시 눌리지 않게 로딩인 채로 떠난다.
    router.dismissTo('/my/sync');
  };

  // 보내는 동안에는 떠나지 않는다. 그 사이에 떠나면 성공한 뒤 엉뚱한 화면이 동기화 상태 화면으로 바뀐다.
  const goBack = useCallback(() => {
    if (!submittingRef.current) leaveAccountScreen();
  }, []);
  // 폰의 뒤로 가기도 상단 뒤로 가기와 같게 한다
  useAndroidBack(goBack);

  /**
   * 로그인 ↔ 회원가입. 쌓지 않고 바꿔 끼운다 — 둘이 쌓이면 성공한 뒤 동기화 상태 화면에서
   * 뒤로 갔을 때 로그인 · 가입 화면이 다시 나온다.
   */
  const switchTo = (href: '/my/login' | '/my/signup') => {
    if (!submittingRef.current) router.replace(href);
  };

  return { form, errors, submitting, change, submit, goBack, switchTo };
}
