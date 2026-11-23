/** 계정 · 동기화 상태를 화면에 그릴 글자로 바꾼다: 내 정보 탭 위쪽의 계정 영역, "동기화 상태" 줄, 동기화 상태 화면(MY_01_002). */
import { formatClock, formatDateTime } from './format';
import { isSameDay } from './week';

/**
 * loading = 저장된 로그인 정보를 아직 읽지 못함 / signedOut = 로그인한 적 없음(또는 로그아웃함) /
 * signedIn = 로그인됨 / expired = 로그인이 만료됨(다시 로그인해야 올릴 수 있다. 올릴 기록은 그대로 남는다)
 */
export type AccountStatus = 'loading' | 'signedOut' | 'signedIn' | 'expired';

/** 마지막 동기화가 끝까지 가지 못한 까닭. offline = 서버에 닿지 못함 / server = 서버 오류 / expired = 로그인 만료 */
export type SyncProblem = 'offline' | 'server' | 'expired';

export type SyncInput = {
  status: AccountStatus;
  email: string | null;
  syncing: boolean;
  problem: SyncProblem | null;
  /** 폰에만 있는 끝난 러닝 수. 아직 세지 않았으면 null */
  localOnlyCount: number | null;
  /** 그중 서버가 받지 않아 올릴 수 없는 수 */
  unsendableCount: number;
  lastSyncAt: number | null;
  now: number;
};

/** connect = 로그인 화면으로 / sync = 지금 동기화 / relogin = 다시 로그인 화면으로 */
export type SyncActionKind = 'connect' | 'sync' | 'relogin';

export type AccountView = {
  /** 내 정보 탭 위쪽: "로그인 없이 사용 중" 또는 이메일 */
  headerTitle: string;
  headerSubtitle: string;
  /** 계정 영역의 버튼. 로그인돼 있으면 null(버튼 없이 "동기화 상태" 줄로 들어간다) */
  headerAction: { kind: 'connect' | 'relogin'; label: string } | null;
  /** 설정의 "동기화 상태" 줄 값: "연결 안 됨" / "동기화됨" / "올릴 기록 2개" … */
  rowText: string;

  /** 동기화 상태 화면의 카드 */
  statusTitle: string;
  statusBody: string;
  /** "–" / "오늘 오전 7:12" / "11월 20일 (목) 오전 7:12" */
  lastSyncText: string;
  /** "12개" (아직 세지 않았으면 "–") */
  localOnlyText: string;
  /** 서버가 받지 않는 기록이 있을 때의 한 줄. 없으면 null */
  unsendableNote: string | null;
  /** 마지막 동기화가 실패한 까닭. 없으면 null */
  problemNote: string | null;
  primaryAction: { kind: SyncActionKind; label: string };
  /** 동기화가 도는 중(버튼을 로딩으로 바꾼다) */
  busy: boolean;
  /** [로그아웃]을 보여 줄지 */
  canLogOut: boolean;
};

export const SIGNED_OUT_BODY =
  '기록은 먼저 이 폰에 저장돼요. 계정을 연결하면 인터넷이 될 때 서버로 올라가고, 웹 대시보드에서도 볼 수 있어요.';
const EXPIRED_BODY = '로그인이 만료됐어요. 올릴 기록은 이 폰에 그대로 있고, 다시 로그인하면 이어서 올라가요.';
const PROBLEM_NOTES: Record<SyncProblem, string | null> = {
  offline: '서버에 연결하지 못했어요. 인터넷이 되면 다시 올라가요.',
  server: '서버에 문제가 있어 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  // 만료는 카드가 이미 알려 준다
  expired: null,
};
const NO_VALUE = '–';

/** 로그인 화면의 안내 문장. 올릴 기록이 없으면(또는 아직 세지 않았으면) 뒤 문장은 맞지 않아서 뺀다. */
export function loginIntro(localOnlyCount: number | null): string {
  const base = '웹 대시보드와 같은 계정이에요.';
  return localOnlyCount ? `${base} 로그인하면 이 폰의 기록 ${localOnlyCount}개가 함께 올라가요.` : base;
}

function lastSyncText(lastSyncAt: number | null, now: number): string {
  if (lastSyncAt == null) return NO_VALUE;
  return isSameDay(lastSyncAt, now) ? `오늘 ${formatClock(lastSyncAt)}` : formatDateTime(lastSyncAt);
}

export function describeAccount(input: SyncInput): AccountView {
  const { status, email, syncing, localOnlyCount, unsendableCount } = input;
  const localOnly = localOnlyCount ?? 0;
  // 올릴 수 있는데 아직 안 올라간 수
  const pending = Math.max(0, localOnly - unsendableCount);

  const shared = {
    lastSyncText: lastSyncText(input.lastSyncAt, input.now),
    localOnlyText: localOnlyCount == null ? NO_VALUE : `${localOnlyCount}개`,
    busy: syncing,
  };

  if (status === 'signedIn') {
    const subtitle = syncing
      ? '동기화하는 중이에요'
      : pending > 0
        ? `올릴 기록 ${pending}개가 있어요`
        : '모든 기록이 서버에 올라가 있어요';
    return {
      ...shared,
      headerTitle: email ?? '로그인됨',
      headerSubtitle: subtitle,
      headerAction: null,
      rowText: syncing ? '동기화 중' : pending > 0 ? `올릴 기록 ${pending}개` : '동기화됨',
      statusTitle: '계정이 연결돼 있어요',
      statusBody: `${email ?? '이'} 계정으로 기록을 올려요. 같은 계정으로 웹 대시보드에서도 볼 수 있어요.`,
      unsendableNote:
        unsendableCount > 0
          ? `서버가 받을 수 없는 기록 ${unsendableCount}개는 이 폰에만 남아요(24시간이나 300km를 넘는 기록 등).`
          : null,
      problemNote: input.problem ? PROBLEM_NOTES[input.problem] : null,
      primaryAction: { kind: 'sync', label: '지금 동기화' },
      canLogOut: true,
    };
  }

  if (status === 'expired') {
    return {
      ...shared,
      busy: false,
      headerTitle: email ?? '로그인 만료',
      headerSubtitle: '다시 로그인이 필요해요',
      headerAction: { kind: 'relogin', label: '다시 로그인' },
      rowText: '다시 로그인 필요',
      statusTitle: '다시 로그인이 필요해요',
      statusBody: EXPIRED_BODY,
      unsendableNote: null,
      problemNote: null,
      primaryAction: { kind: 'relogin', label: '다시 로그인' },
      canLogOut: true,
    };
  }

  // signedOut, 그리고 아직 읽는 중(loading)에도 같은 모양으로 그린다 — 읽기는 금방 끝난다
  return {
    ...shared,
    busy: false,
    headerTitle: '로그인 없이 사용 중',
    headerSubtitle: localOnly > 0 ? `기록 ${localOnly}개가 이 폰에만 저장돼 있어요` : '기록은 이 폰에 저장돼요',
    headerAction: { kind: 'connect', label: '계정 연결하고 웹에서 보기' },
    rowText: '연결 안 됨',
    statusTitle: '계정이 연결되지 않았어요',
    statusBody: SIGNED_OUT_BODY,
    unsendableNote: null,
    problemNote: null,
    primaryAction: { kind: 'connect', label: '계정 연결' },
    canLogOut: false,
  };
}
