import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckIcon, MapPinIcon } from '@/components/icons';
import { OnboardingStep, OnboardingTextAction } from '@/components/onboarding/OnboardingStep';
import { requestLocationAccess, requestNotificationAccess } from '@/services/permissions';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

const REASONS = ['러닝 경로 · 거리 기록', '구간 · 페이스 음성 안내', '알림창에서 일시정지 · 다시 시작'];

const CHECK_SIZE = 20;

/** ONB_01_001 Step 1. 권한 안내: 위치 → 알림 순서로 권한을 묻는다. 거부해도 다음 단계로 간다. */
export default function PermissionStep() {
  const { colors } = useTheme();
  const [requesting, setRequesting] = useState(false);
  // 버튼이 로딩으로 바뀌기 전에 한 번 더 눌려도 권한 창이 두 번 뜨지 않게 한다
  const requestingRef = useRef(false);

  // 같은 화면을 두 번 쌓지 않도록 push가 아니라 navigate를 쓴다(빠르게 두 번 눌렀을 때)
  const goNext = () => router.navigate('/onboarding/battery');

  const allow = async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    setRequesting(true);
    // 권한을 거부하거나 요청이 실패해도 막지 않는다. 러닝을 시작할 때 다시 안내한다.
    try {
      await requestLocationAccess();
    } catch (error) {
      console.warn('[onboarding] 위치 권한을 요청하지 못했어요', error);
    }
    try {
      await requestNotificationAccess();
    } catch (error) {
      console.warn('[onboarding] 알림 권한을 요청하지 못했어요', error);
    }
    requestingRef.current = false;
    setRequesting(false);
    goNext();
  };

  return (
    <OnboardingStep
      step={1}
      icon={MapPinIcon}
      // 피그마 문구는 '항상 허용'이지만 이 앱은 '앱 사용 중에만 허용'까지만 요청한다(Q-007)
      title="위치를 '앱 사용 중에만 허용'으로 켜 주세요"
      description="화면을 끄고 주머니에 넣어도 경로와 거리가 끊기지 않게 기록해요. 위치는 러닝 중에만 써요."
      footer={
        <>
          <Button label="허용하기" loading={requesting} onPress={allow} />
          <OnboardingTextAction label="나중에 할게요" disabled={requesting} onPress={goNext} />
        </>
      }>
      <View style={styles.reasons}>
        {REASONS.map((reason) => (
          <View key={reason} style={styles.reason}>
            <CheckIcon size={CHECK_SIZE} color={colors.iconMain} />
            <AppText variant="body15R" style={styles.reasonText}>
              {reason}
            </AppText>
          </View>
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: space[3] },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  reasonText: { flex: 1 },
});
