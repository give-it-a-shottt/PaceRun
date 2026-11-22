import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertDialog } from '@/components/AlertDialog';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PlanTemplateCard } from '@/components/plan/PlanTemplateCard';
import { PLAN_SAVE_ERROR } from '@/components/plan/WorkoutSheet';
import { useAndroidBack } from '@/components/run/useAndroidBack';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { PLAN_TEMPLATES } from '@/domain/plan';
import { applyTemplate, hasPlan, type PlanTemplate } from '@/services/planData';
import { showToast } from '@/state/toastStore';
import { layout, space } from '@/theme/tokens';

/** 온보딩에서 바로 왔으면 돌아갈 화면이 없으므로 그때는 계획 탭으로 간다 */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/plan');
}

/** PLN_01_003 템플릿 선택: 템플릿 하나를 골라 [이번 주에 적용]. 계획이 이미 있으면 바꿀지 먼저 묻는다. */
export default function PlanTemplatesScreen() {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState(PLAN_TEMPLATES[0].id);
  /** 덮어쓰기를 물어보는 중인 템플릿. 묻는 창이 떠 있는 동안에만 값이 있다. */
  const [confirming, setConfirming] = useState<PlanTemplate | null>(null);
  const [applying, setApplying] = useState(false);
  // 버튼이 로딩으로 바뀌기 전에 한 번 더 눌려도 두 번 적용하지 않게 한다
  const applyingRef = useRef(false);
  // 제스처 바는 34로 충분하지만, 3버튼 내비게이션 바는 더 높아서 버튼이 가려지지 않게 넓힌다
  const paddingBottom = Math.max(layout.bottomSafePadding, insets.bottom + space[2]);

  // 폰의 뒤로 가기도 상단 뒤로 가기와 같게 한다(돌아갈 화면이 없을 때 앱이 닫히지 않게)
  useAndroidBack(leave);

  const setBusy = (busy: boolean) => {
    applyingRef.current = busy;
    setApplying(busy);
  };

  const fail = (error: unknown) => {
    console.warn('[plan] 템플릿을 적용하지 못했어요', error);
    setBusy(false);
    showToast(PLAN_SAVE_ERROR);
  };

  const apply = async (template: PlanTemplate) => {
    setBusy(true);
    try {
      await applyTemplate(template);
    } catch (error) {
      fail(error);
      return;
    }
    // 화면이 넘어가는 사이에 다시 눌리지 않게 로딩인 채로 떠난다
    leave();
  };

  const handleApply = async () => {
    if (applyingRef.current) return;
    const template = PLAN_TEMPLATES.find((candidate) => candidate.id === selectedId) ?? PLAN_TEMPLATES[0];
    setBusy(true);
    let exists: boolean;
    try {
      exists = await hasPlan();
    } catch (error) {
      fail(error);
      return;
    }
    if (exists) {
      setBusy(false);
      setConfirming(template);
      return;
    }
    await apply(template);
  };

  const confirmReplace = () => {
    const template = confirming;
    setConfirming(null);
    if (template && !applyingRef.current) void apply(template);
  };

  return (
    <Screen>
      <TopBar variant="back" title="템플릿 선택" onBack={leave} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <AppText variant="body14R" color="textSub">
          고르면 이번 주부터 매주 같은 요일에 채워져요. 나중에 요일마다 바꿀 수 있어요.
        </AppText>
        <View accessibilityRole="radiogroup" style={styles.cards}>
          {PLAN_TEMPLATES.map((template) => (
            <PlanTemplateCard
              key={template.id}
              template={template}
              selected={template.id === selectedId}
              onPress={() => {
                // 적용하는 사이에 바꾸면 화면에 고른 것과 적용된 것이 달라진다
                if (!applyingRef.current) setSelectedId(template.id);
              }}
            />
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom }]}>
        <Button label="이번 주에 적용" loading={applying} onPress={() => void handleApply()} />
      </View>

      <AlertDialog
        visible={confirming != null}
        title="지금 계획을 바꿀까요?"
        message="지금 있는 요일별 운동이 템플릿으로 바뀌어요."
        actions={[
          { label: '바꾸기', onPress: confirmReplace },
          { label: '취소', onPress: () => setConfirming(null) },
        ]}
        onRequestClose={() => setConfirming(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[4],
    gap: space[3],
  },
  cards: { gap: space[3] },
  footer: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX },
});
