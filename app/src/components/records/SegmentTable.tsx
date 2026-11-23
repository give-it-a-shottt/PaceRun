import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { SegmentRowView } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

// 피그마 러닝 상세(11:1274) 표의 열 너비. 종류 열이 남는 자리를 차지한다.
const NO_WIDTH = 72;
const DURATION_WIDTH = 72;
const PACE_WIDTH = 80;

/** "구간 기록" 표: 구간 번호 · 종류 · 시간 · 페이스. 받은 줄을 그리기만 한다. */
export function SegmentTable({ segments }: { segments: readonly SegmentRowView[] }) {
  const { colors } = useTheme();
  const line = { borderBottomColor: colors.lineLight };

  return (
    <View>
      <View style={[styles.row, styles.head, line]}>
        <AppText variant="caption12M" color="textSub" style={styles.no}>
          구간
        </AppText>
        <AppText variant="caption12M" color="textSub" style={styles.kind}>
          종류
        </AppText>
        <AppText variant="caption12M" color="textSub" style={styles.duration}>
          시간
        </AppText>
        <AppText variant="caption12M" color="textSub" style={styles.pace}>
          페이스
        </AppText>
      </View>

      {segments.map((segment) => {
        // 걷기 구간은 쉬어 가는 줄이라 옅게 적는다(피그마)
        const resting = segment.resting;
        return (
          <View
            key={segment.no}
            accessible
            accessibilityLabel={`${segment.no}구간, ${segment.kindText}, 시간 ${segment.durationText}, 페이스 ${segment.paceText}`}
            style={[styles.row, styles.body, line]}>
            <AppText variant="body14R" style={styles.no}>
              {segment.no}
            </AppText>
            <AppText
              variant={resting ? 'body14R' : 'body14M'}
              color={resting ? 'textSub' : 'textMain'}
              numberOfLines={1}
              style={styles.kind}>
              {segment.kindText}
            </AppText>
            <AppText variant="body14R" tabular style={styles.duration}>
              {segment.durationText}
            </AppText>
            <AppText variant="body14R" tabular style={styles.pace}>
              {segment.paceText}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  // 피그마는 줄(위아래 여백 8 · 12)과 구분선 사이를 8씩 더 띄운다
  head: { paddingTop: space[2], paddingBottom: space[4] },
  body: { paddingVertical: space[5] },
  no: { width: NO_WIDTH },
  kind: { flex: 1 },
  duration: { width: DURATION_WIDTH },
  pace: { width: PACE_WIDTH },
});
