import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FlagCheckeredIcon, MapPinIcon } from '@/components/icons';
import { projectRoute } from '@/domain/route';
import type { RoutePosition } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

// 피그마 Route Map(8:478 · 11:1248)의 값. 그림 상자는 피그마 화면 너비(375)에서의 크기로 잡고, 폰 너비에 맞춰 같은 비율로 늘린다.
const BOX_WIDTH = 335;
const ROUTE_STROKE_WIDTH = 4;
const MARK_SIZE = 20;
/** 출발 · 도착 표시를 경로 끝점에 놓는 자리(피그마: 끝점이 아이콘의 가운데 조금 아래에 온다) */
const MARK_OFFSET_X = -MARK_SIZE / 2;
const MARK_OFFSET_Y = -14;
/** 경로 선과 출발 · 도착 표시가 상자 밖으로 나가지 않게 두는 안쪽 여백 */
const BOX_PADDING = space[8];

type Props = {
  route: readonly RoutePosition[];
  /** 피그마 화면 너비에서의 상자 높이(러닝 상세 180, 완료 요약 140) */
  height: number;
};

/**
 * 작은 지도: 옅은 바탕 위에 경로 선과 출발 · 도착 표시만 그린다(지도 타일은 깔지 않는다 — D-008).
 * 그릴 경로가 없으면(점이 없거나 거의 움직이지 않음) 상자 자체를 그리지 않는다.
 */
export function RouteMap({ route, height }: Props) {
  const { colors } = useTheme();
  const shape = useMemo(
    () => projectRoute(route, { width: BOX_WIDTH, height, padding: BOX_PADDING }),
    [route, height],
  );

  if (!shape) return null;

  // 상자가 폰 너비에 따라 커지므로 표시의 자리는 상자 크기에 대한 비율로 준다
  const markAt = (point: { x: number; y: number }) =>
    ({ left: `${(point.x / BOX_WIDTH) * 100}%`, top: `${(point.y / height) * 100}%` }) as const;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="러닝 경로"
      style={[styles.box, { aspectRatio: BOX_WIDTH / height, backgroundColor: colors.bgRegular }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${BOX_WIDTH} ${height}`}>
        <Path
          d={shape.path}
          fill="none"
          stroke={colors.laneDone}
          strokeWidth={ROUTE_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={[styles.mark, markAt(shape.start)]}>
        <MapPinIcon size={MARK_SIZE} color={colors.iconMain} />
      </View>
      <View style={[styles.mark, markAt(shape.end)]}>
        <FlagCheckeredIcon size={MARK_SIZE} color={colors.iconMain} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', borderRadius: radius.card, overflow: 'hidden' },
  mark: { position: 'absolute', marginLeft: MARK_OFFSET_X, marginTop: MARK_OFFSET_Y },
});
