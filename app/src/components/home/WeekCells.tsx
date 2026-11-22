import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon, PersonSimpleRunIcon } from '@/components/icons';
import type { WeekCellView } from '@/services/homeData';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

// 피그마 Week Cell(6:54)의 값. 칸 · 형광 띠 크기와 기울기는 피그마에 변수가 없어 숫자 그대로다.
const CELL_SIZE = 44;
const CELL_ICON_SIZE = 20;
const TODAY_BORDER = 2;
const BAND_WIDTH = 40;
const BAND_HEIGHT = 24;
const BAND_RADIUS = 2;
const BAND_TILT = '-1.5deg';
/** 띠는 칸 가운데보다 조금 아래에 놓인다(체크 아래쪽에 밑줄을 긋듯이) */
const BAND_OFFSET_Y = 3.5;
/** pacerun-design.md 5장 모션 스펙 "형광펜 칠하기" */
const PAINT_DURATION_MS = 300;
const PAINT_DELAY_MS = 200;

type Props = {
  cells: readonly WeekCellView[];
  /** 오늘 칸을 칠하게 만든 러닝의 번호. 같은 러닝으로는 한 번만 칠하는 모션을 보여 준다. */
  paintKey?: string | null;
};

/** 이번 주 칸 7개(월~일). 받은 값을 그리기만 한다. */
export function WeekCells({ cells, paintKey = null }: Props) {
  return (
    <View style={styles.row}>
      {cells.map((cell) => (
        <WeekCell key={cell.label} cell={cell} paintKey={paintKey} />
      ))}
    </View>
  );
}

function WeekCell({ cell, paintKey }: { cell: WeekCellView; paintKey: string | null }) {
  const { colors } = useTheme();

  const box = cell.isToday
    ? { backgroundColor: colors.bgDefault, borderWidth: TODAY_BORDER, borderColor: colors.lineBlack }
    : cell.state === 'done'
      ? { backgroundColor: colors.bgDefault, borderWidth: 1, borderColor: colors.lineRegular }
      : cell.state === 'planned'
        ? { backgroundColor: colors.bgDefault, borderWidth: 1, borderColor: colors.lineStrong }
        : { backgroundColor: colors.bgRegular };

  return (
    // 색 · 모양만으로 알리지 않도록 칸 하나를 "토요일, 계획 있음"처럼 한 번에 읽어 준다
    <View accessible accessibilityLabel={cell.accessibilityLabel} style={styles.cell}>
      <AppText
        variant={cell.isToday ? 'caption12SB' : 'caption12R'}
        color={cell.isToday ? 'textMain' : 'textSub'}
        style={styles.day}>
        {cell.label}
      </AppText>
      <View style={[styles.box, box]}>
        {cell.state === 'done' ? (
          <>
            <View style={styles.bandLayer}>
              {/* 칠하는 모션은 오늘 칸에서만 보여 준다. 지난 완료 칸은 움직이지 않는다. */}
              {cell.isToday ? <PaintedBand paintKey={paintKey} /> : <View style={[styles.band, { backgroundColor: colors.sub1Base }]} />}
            </View>
            <CheckIcon size={CELL_ICON_SIZE} color={colors.iconMain} />
          </>
        ) : null}
        {cell.state === 'today' ? <AppText variant="caption11SB">오늘</AppText> : null}
        {cell.state === 'planned' ? <PersonSimpleRunIcon size={CELL_ICON_SIZE} color={colors.iconSub} /> : null}
        {cell.state === 'rest' ? (
          <AppText variant="caption11M" color="textSub">
            쉼
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** 이미 칠하는 모션을 보여 준 러닝. 앱을 켜 둔 동안 기억한다. */
let lastPaintedKey: string | null = null;

/**
 * 오늘 완료 칸의 형광 띠. 러닝을 끝내고 홈에 처음 돌아왔을 때 한 번만 왼쪽에서 오른쪽으로 칠해진다
 * ("보상은 형광펜 한 번" — 탭을 오갈 때마다 다시 칠하지 않는다).
 */
function PaintedBand({ paintKey }: { paintKey: string | null }) {
  const { colors } = useTheme();
  const [scaleX] = useState(() => new Animated.Value(paintKey != null && paintKey !== lastPaintedKey ? 0 : 1));

  useFocusEffect(
    useCallback(() => {
      if (paintKey == null || paintKey === lastPaintedKey) {
        scaleX.setValue(1);
        return;
      }
      lastPaintedKey = paintKey;
      let focused = true;
      AccessibilityInfo.isReduceMotionEnabled()
        .catch(() => false)
        .then((reduceMotion) => {
          if (!focused) return;
          // '동작 줄이기'를 켠 사람에게는 바로 채워서 보여 준다
          if (reduceMotion) {
            scaleX.setValue(1);
            return;
          }
          Animated.timing(scaleX, {
            toValue: 1,
            duration: PAINT_DURATION_MS,
            delay: PAINT_DELAY_MS,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        });
      return () => {
        focused = false;
        // 칠하는 도중에 화면을 떠나면 다 칠한 것으로 둔다
        scaleX.stopAnimation();
        scaleX.setValue(1);
      };
    }, [scaleX, paintKey]),
  );

  return (
    <Animated.View
      style={[styles.band, styles.paintFromLeft, { backgroundColor: colors.sub1Base, transform: [{ scaleX }] }]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  // 화면이 좁으면(7칸 308보다 좁을 때) 칸이 같은 비율로 줄어든다
  cell: { flexBasis: CELL_SIZE, flexShrink: 1, gap: space[1] },
  day: { textAlign: 'center' },
  box: {
    alignSelf: 'stretch',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  bandLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: BAND_OFFSET_Y }, { rotate: BAND_TILT }],
    pointerEvents: 'none',
  },
  band: { width: BAND_WIDTH, height: BAND_HEIGHT, borderRadius: BAND_RADIUS },
  paintFromLeft: { transformOrigin: 'left' },
});
