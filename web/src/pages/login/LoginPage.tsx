import { CircleNotchIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react';
import { useId, useRef, useState, type FormEvent } from 'react';

import { ApiError, NetworkError } from '../../api/client';
import { logIn } from '../../api/session';
import logoMark from '../../assets/logo-mark.svg';
import {
  hasErrors,
  loginFailureErrors,
  validateLogin,
  type LoginErrors,
  type LoginFailure,
} from '../../domain/loginForm';
import styles from './LoginPage.module.css';

const LOGO_SIZE = 40;
const HELPER_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 20;

/** 던져진 오류를 문구를 고르는 데 쓰는 모양으로 바꾼다. 오류 내용은 어디에도 찍지 않는다(입력값이 섞일 수 있다). */
function toLoginFailure(error: unknown): LoginFailure {
  if (error instanceof ApiError) return { kind: 'api', status: error.status, code: error.code };
  if (error instanceof NetworkError) return { kind: 'network' };
  return { kind: 'unknown' };
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className={styles.fieldError} role="alert">
      <WarningIcon size={HELPER_ICON_SIZE} className={styles.fieldErrorIcon} aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/** WEB_01_001 로그인. 가입은 앱에서만 한다(아래 안내 문구). */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const emailErrorId = `${id}-email-error`;
  const passwordErrorId = `${id}-password-error`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const found = validateLogin({ email, password });
    setErrors(found);
    if (hasErrors(found)) {
      // 고칠 첫 칸으로 데려간다
      (found.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // 성공하면 로그인 상태가 바뀌어 대시보드로 간다(app/guards.tsx의 GuestOnly)
      await logIn(email.trim(), password);
    } catch (error) {
      setErrors(loginFailureErrors(toLoginFailure(error)));
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-title`}>
        <div className={styles.brand}>
          <img src={logoMark} alt="" width={LOGO_SIZE} height={LOGO_SIZE} />
          <span>Pace Run</span>
        </div>

        <div className={styles.intro}>
          <h1 id={`${id}-title`} className={styles.title}>
            로그인
          </h1>
          <p className={styles.description}>앱에서 계정을 연결한 이메일로 로그인하면 기록을 크게 볼 수 있어요.</p>
        </div>

        <div className={styles.field}>
          <label htmlFor={emailId} className={styles.label}>
            이메일
          </label>
          <input
            ref={emailRef}
            id={emailId}
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? emailErrorId : undefined}
            readOnly={submitting}
          />
          {errors.email && <FieldError id={emailErrorId} message={errors.email} />}
        </div>

        <div className={styles.field}>
          <label htmlFor={passwordId} className={styles.label}>
            비밀번호
          </label>
          <input
            ref={passwordRef}
            id={passwordId}
            className={styles.input}
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            readOnly={submitting}
          />
          {errors.password && <FieldError id={passwordErrorId} message={errors.password} />}
        </div>

        {errors.form && (
          <p className={styles.formError} role="alert">
            <WarningIcon size={HELPER_ICON_SIZE} className={styles.fieldErrorIcon} aria-hidden />
            <span>{errors.form}</span>
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={submitting} aria-busy={submitting || undefined}>
          {submitting && <CircleNotchIcon size={BUTTON_ICON_SIZE} className={styles.spinner} aria-hidden />}
          {submitting ? '로그인하는 중' : '로그인'}
        </button>

        <p className={styles.notice}>
          <InfoIcon size={HELPER_ICON_SIZE} className={styles.noticeIcon} aria-hidden />
          <span>계정은 앱의 내 정보 › 계정 연결에서 만들 수 있어요.</span>
        </p>
      </form>
    </main>
  );
}
