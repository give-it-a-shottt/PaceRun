import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { GaugeView } from '@/domain/runView';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

// 피그마 Pace Gauge(6:59)의 값. 크기 · 모서리는 피그마에 변수가 없어 숫자 그대로다.
const GAUGE_MIN_HEIGHT = 64;
const AREA_HEIGHT = 32;
const TRACK_HEIGHT = 8;
const BAND_HEIGHT = 16;
const BAND_RADIUS = 4;
const MARKER_WIDTH = 4;
// 피그마 컴포넌트는 32지만 pacerun-design.md 7장의 4 × 24를 따른다
const MARKER_HEIGHT = 24;
const MARKER_RADIUS = 2;

/** 트랙 한쪽 끝은 목표에서 허용 범위의 6배만큼 벗어난 페이스다. 그보다 더 벗어나면 끝에 붙여 둔다. */
const RANGE_IN_TOLERANCES = 6;
const BAND_WIDTH_PERCENT = 100 / RANGE_IN_TOLERANCES;

/** 마커의 가로 위치(0 = 왼쪽 끝 '느림', 100 = 오른쪽 끝 '빠름'). 재는 중이면 null. */
function markerPercent(gauge: GaugeView): number | null {
  if (gauge.gapSec == null) return null;
  const range = gauge.toleranceSec * RANGE_IN_TOLERANCES;
  const clamped = Math.min(range, Math.max(-range, gauge.gapSec));
  return 50 - (clamped / range) * 50;
}

/** 페이스메이커의 목표 띠 게이지. 받은 값을 그리기만 하고, 글자(gauge.text)를 항상 함께 보여 준다. */
export function PaceGauge({ gauge }: { gauge: GaugeView }) {
  const { colors } = useTheme();
  const marker = markerPercent(gauge);

  return (
    <View accessible accessibilityLabel={gauge.text} style={styles.root}>
      <View style={styles.gauge}>
        <View style={styles.area}>
          <View style={[styles.track, { backgroundColor: colors.lineLight }]} />
          <View style={[styles.band, { backgroundColor: colors.primarySoft, borderColor: colors.laneDone }]} />
          {marker == null ? null : (
            <View style={[styles.marker, { left: `${marker}%`, backgroundColor: colors.iconMain }]} />
          )}
        </View>
        <View style={styles.labels}>
          <AppText variant="caption12R" color="textSub" style={styles.slow}>
            느림
          </AppText>
          <AppText variant="caption12SB">목표</AppText>
          <AppText variant="caption12R" color="textSub" style={styles.fast}>
            빠름
          </AppText>
        </View>
      </View>

      <AppText variant="body14M" tabular>
        {gauge.text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[2] },
  gauge: { minHeight: GAUGE_MIN_HEIGHT, paddingTop: space[1] },
  area: { height: AREA_HEIGHT },
  track: {
    position: 'absolute',
    top: (AREA_HEIGHT - TRACK_HEIGHT) / 2,
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  band: {
    position: 'absolute',
    top: (AREA_HEIGHT - BAND_HEIGHT) / 2,
    left: `${50 - BAND_WIDTH_PERCENT / 2}%`,
    width: `${BAND_WIDTH_PERCENT}%`,
    height: BAND_HEIGHT,
    borderWidth: 1,
    borderRadius: BAND_RADIUS,
  },
  marker: {
    position: 'absolute',
    top: (AREA_HEIGHT - MARKER_HEIGHT) / 2,
    // left가 막대의 가운데를 가리키게 한다
    marginLeft: -MARKER_WIDTH / 2,
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    borderRadius: MARKER_RADIUS,
  },
  labels: { flexDirection: 'row', alignItems: 'flex-start' },
  slow: { flex: 1 },
  fast: { flex: 1, textAlign: 'right' },
});
