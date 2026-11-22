/**
 * 디자인 토큰. 값의 기준은 피그마 Pace-Run 파일의 변수이고, 이름도 피그마 변수 이름을 그대로 옮겼다
 * (예: `text/main` → `textMain`). 값을 바꿀 때는 피그마와 pacerun-design.md를 먼저 바꾼다.
 */

export const lightColors = {
  textMain: '#111111',
  textSub: '#424242',
  /** 흰 바탕(bg/default) 위에서만 쓴다. 회색 바탕에서는 대비가 모자라 textSub를 쓴다. */
  textSubWeak: '#757575',
  textInverse: '#ffffff',
  textOnPrimary: '#ffffff',

  iconMain: '#212121',
  iconSub: '#616161',
  iconInverse: '#ffffff',
  iconOnPrimary: '#ffffff',

  bgDefault: '#ffffff',
  bgLight: '#fafafa',
  bgRegular: '#f5f5f5',
  bgElevated: '#ffffff',
  bgInverse: '#111111',
  bgDim: '#11111199',
  bgDimWeak: '#11111166',

  lineLight: '#eeeeee',
  lineRegular: '#e0e0e0',
  lineStrong: '#bdbdbd',
  lineBlack: '#111111',

  primaryDefault: '#76314b',
  primaryPressed: '#542336',
  primaryText: '#76314b',
  primarySoft: '#f6eff2',
  primarySoftPressed: '#ede0e5',
  primaryAccent: '#8e3b5a',

  sub1Base: '#ffd43b',
  sub1Soft: '#fffcef',
  sub1Text: '#7e681b',

  laneDone: '#76314b',

  badgePlumText: '#76314b',
  badgePlumSoft: '#f6eff2',
  badgeBlackText: '#212121',
  badgeBlackSoft: '#f2f2f2',

  statusSuccessBase: '#2e9e6a',
  statusSuccessText: '#1e6b47',
  statusWarningBase: '#e0a100',
  statusWarningText: '#8a6200',
  statusWarningBg: '#fff8e6',
  /** 피그마 화면에 오류 색 변수가 없어 임시로 둔 값이다(입력 오류 문구용). */
  statusErrorText: '#b3261e',
} as const;

export type ColorName = keyof typeof lightColors;
export type Colors = Record<ColorName, string>;

/**
 * Dark는 러닝 화면(RUN_*)에서만 쓴다. 피그마 Dark 프레임에 나온 변수만 값이 확정이고,
 * 나머지는 Light 값을 그대로 물려받는다(러닝 화면에서 쓰지 않는 토큰).
 */
export const darkColors: Colors = {
  ...lightColors,
  textMain: '#f2f2f5',
  textSub: '#bdbdc7',
  textSubWeak: '#bdbdc7',
  textInverse: '#18181d',

  iconMain: '#e6e6ec',
  iconSub: '#adadb8',
  iconInverse: '#18181d',

  bgDefault: '#18181d',
  bgInverse: '#f2f2f5',

  lineLight: '#232329',
  lineBlack: '#f2f2f5',

  primaryText: '#c499a9',
  primarySoft: '#2b1e27',
  primarySoftPressed: '#3e1b28',

  sub1Soft: '#3e3722',
  sub1Text: '#ffe999',

  laneDone: '#c499a9',
};

export const space = {
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

export const radius = {
  tag: 6,
  button: 8,
  input: 8,
  card: 16,
  modal: 16,
  sheet: 20,
  full: 999,
} as const;

/** 화면 좌우 여백(MO 20)과 러닝 화면 하단 버튼 영역의 제스처 바 여백. */
export const layout = {
  screenPaddingX: space[5],
  bottomSafePadding: 34,
  topBarHeight: 56,
  dockTabHeight: 56,
} as const;

type FontWeight = '400' | '500' | '600' | '700';

function font(size: number, weight: FontWeight, lineHeight: number) {
  return {
    fontFamily: 'Pretendard',
    fontWeight: weight,
    fontSize: size,
    lineHeight,
    // 피그마 자간 -2.5%
    letterSpacing: size * -0.025,
  } as const;
}

/** 피그마 텍스트 스타일 `KR/{묶음}/{굵기}/{크기}`에 대응한다. */
export const typography = {
  display56SB: font(56, '600', 73),
  headline24SB: font(24, '600', 34),
  headline20SB: font(20, '600', 28),
  title20R: font(20, '400', 28),
  title18SB: font(18, '600', 25),
  title18M: font(18, '500', 25),
  title16SB: font(16, '600', 22),
  body16R: font(16, '400', 22),
  body15R: font(15, '400', 22),
  body14R: font(14, '400', 20),
  body14M: font(14, '500', 20),
  body13R: font(13, '400', 19),
  caption13M: font(13, '500', 19),
  caption12R: font(12, '400', 17),
  caption12M: font(12, '500', 17),
  caption12SB: font(12, '600', 17),
  caption11M: font(11, '500', 16),
  caption11SB: font(11, '600', 16),
} as const;

export type TypographyName = keyof typeof typography;
