import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';

import { GpsNotice } from './GpsNotice';
import { LocationAlert } from './LocationAlert';
import { TextLink } from './TextLink';
import type { QuickRun } from './useQuickRun';

type Props = { quickRun: QuickRun };

/** [10분만 뛰기] 버튼 위: GPS 신호를 찾는 동안의 안내(RUN_02_001) */
export function QuickRunGpsNotice({ quickRun }: Props) {
  return quickRun.searchingGps ? <GpsNotice /> : null;
}

/** [10분만 뛰기] 버튼 아래: GPS 신호를 찾는 동안의 [그냥 시작하기] · [취소] */
export function QuickRunGpsLinks({ quickRun }: Props) {
  if (!quickRun.searchingGps) return null;
  return (
    <View style={styles.links}>
      <TextLink label="그냥 시작하기" onPress={quickRun.startAnyway} />
      <TextLink label="취소" onPress={quickRun.cancel} />
    </View>
  );
}

/** 위치를 쓸 수 없어 시작하지 못했을 때의 안내 창(RUN_02_002) */
export function QuickRunLocationAlert({ quickRun }: Props) {
  return quickRun.locationIssue ? (
    <LocationAlert issue={quickRun.locationIssue} onClose={quickRun.dismissLocationIssue} />
  ) : null;
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'center', gap: space[6] },
});
