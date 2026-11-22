import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { BatteryWarningIcon, CheckIcon } from '@/components/icons';
import { OnboardingStep, OnboardingTextAction } from '@/components/onboarding/OnboardingStep';
import { getBatteryOptimization, openBatterySettings } from '@/services/permissions';
import { showToast } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const GUIDE_STEPS = ['아래 [설정 열기]를 눌러요', "배터리 → '제한 없음'을 골라요", '뒤로 가기로 돌아와요'];

const NUMBER_SIZE = 24;

/** ONB_01_002 Step 2. 배터리 최적화 해제: 설정 화면으로 보내고, 돌아오면 풀렸는지 다시 확인한다. 건너뛸 수 있다. */
export default function BatteryStep() {
  const { colors } = useTheme();
  const unrestricted = useBatteryUnrestricted();

  // 같은 화면을 두 번 쌓지 않도록 push가 아니라 navigate를 쓴다(빠르게 두 번 눌렀을 때)
  const goNext = () => router.navigate('/onboarding/goal');

  const openSettings = () => {
    openBatterySettings().catch((error) => {
      console.warn('[onboarding] 배터리 설정 화면을 열지 못했어요', error);
      showToast('설정 화면을 열지 못했어요.');
    });
  };

  if (unrestricted) {
    // 피그마에 없는 상태. 같은 틀에서 아이콘 · 문구 · 버튼만 바꿔 가장 단순하게 보여 준다.
    return (
      <OnboardingStep
        step={2}
        icon={CheckIcon}
        title="배터리 최적화가 해제됐어요"
        description="이제 화면이 꺼져도 기록이 끊기지 않아요."
        footer={<Button label="다음" onPress={goNext} />}
      />
    );
  }

  return (
    <OnboardingStep
      step={2}
      icon={BatteryWarningIcon}
      title="배터리 최적화를 꺼 주세요"
      description="갤럭시는 화면이 꺼진 앱을 멈출 수 있어요. Pace Run만 예외로 두면 기록이 끊기지 않아요."
      footer={
        <>
          <Button label="설정 열기" onPress={openSettings} />
          <OnboardingTextAction label="건너뛰기" onPress={goNext} />
        </>
      }>
      <View style={[styles.guide, { backgroundColor: colors.bgLight }]}>
        {GUIDE_STEPS.map((text, index) => (
          <View key={text} style={styles.guideRow}>
            <View style={[styles.number, { backgroundColor: colors.bgInverse }]}>
              <AppText variant="caption12SB" color="textInverse">
                {index + 1}
              </AppText>
            </View>
            <AppText variant="body15R" style={styles.guideText}>
              {text}
            </AppText>
          </View>
        ))}
      </View>
    </OnboardingStep>
  );
}

/**
 * 배터리 최적화가 풀려 있는지. 화면에 들어올 때와, 설정에 다녀와 앱으로 돌아올 때마다 다시 확인한다.
 * 확인이 끝나기 전이거나 확인하지 못했으면 풀리지 않았다고 보고 안내(피그마 기본 모양)를 보여 준다 —
 * 확인하지 못한 것을 "해제됐어요"라고 말하지 않는다.
 */
function useBatteryUnrestricted(): boolean {
  const [unrestricted, setUnrestricted] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => {
      void getBatteryOptimization().then((value) => {
        if (alive) setUnrestricted(value === 'unrestricted');
      });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return unrestricted;
}

const styles = StyleSheet.create({
  guide: { borderRadius: radius.card, padding: space[4], gap: space[3] },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  number: {
    width: NUMBER_SIZE,
    height: NUMBER_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideText: { flex: 1 },
});
