import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { FlagCheckeredIcon } from '@/components/icons';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { ReminderTimePicker } from '@/components/onboarding/ReminderTimePicker';
import { TemplateCard } from '@/components/onboarding/TemplateCard';
import { WeeklyGoalPicker } from '@/components/WeeklyGoalPicker';
import { reminderChoiceOf, reminderTimeOf, type ReminderChoice } from '@/domain/settingsView';
import { completeOnboarding } from '@/services/onboarding';
import { requestNotificationAccess } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';

/** ONB_01_003 Step 3. 주 목표 설정: 주 목표 횟수 · 알림 시간을 고르고 [시작하기]를 누를 때 한 번에 저장한다. */
export default function GoalStep() {
  const savedGoal = useSettingsStore((s) => s.settings.weeklyGoal);
  const savedReminderTime = useSettingsStore((s) => s.settings.reminderTime);
  // 화면이 처음 열릴 때의 값만 본다(저장하면서 true로 바뀌어도 고른 값이 바뀌지 않게)
  const [alreadyDone] = useState(() => useSettingsStore.getState().settings.onboardingDone);

  const [goal, setGoal] = useState(savedGoal);
  // 피그마 기본 모양대로 알림은 켠 채(매일 오전 7:00), 템플릿은 고른 채로 연다.
  // 온보딩을 이미 마친 사람이 주소로 다시 들어온 경우에는 저장된 설정 그대로 연다(꺼 둔 알림을 다시 켜지 않게).
  const [reminder, setReminder] = useState<ReminderChoice>(() => {
    const saved = reminderChoiceOf(savedReminderTime);
    return alreadyDone ? saved : { ...saved, enabled: true };
  });
  const [withTemplate, setWithTemplate] = useState(true);

  const [saving, setSaving] = useState(false);
  // 버튼이 로딩으로 바뀌기 전에 한 번 더 눌려도 두 번 저장하지 않게 한다
  const savingRef = useRef(false);

  const start = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const reminderTime = reminderTimeOf(reminder);
    if (reminderTime) {
      // 저장하면 바로 알림이 예약되므로 그 전에 권한을 묻는다(이미 있으면 창이 뜨지 않는다). 거부해도 진행한다.
      try {
        await requestNotificationAccess();
      } catch (error) {
        console.warn('[onboarding] 알림 권한을 요청하지 못했어요', error);
      }
    }

    // 하나라도 저장되지 않았으면(토스트는 저장소가 띄운다) 이 화면에 남아 다시 누를 수 있게 한다
    if (!(await completeOnboarding({ weeklyGoal: goal, reminderTime }))) {
      savingRef.current = false;
      setSaving(false);
      return;
    }

    // replace로 가서 뒤로 가기로 온보딩에 돌아오지 않게 한다. 템플릿을 고른 채면 템플릿 선택 화면(PLN_01_003)으로 보낸다.
    router.replace(withTemplate ? '/plan/templates' : '/home');
  };

  return (
    <OnboardingStep
      step={3}
      icon={FlagCheckeredIcon}
      title="일주일에 몇 번 뛸까요?"
      description="10분만 뛰어도 1회로 인정돼요. 하루 빠져도 그 주 안에 채우면 연속 기록이 이어져요."
      footer={<Button label="시작하기" loading={saving} onPress={start} />}>
      <WeeklyGoalPicker value={goal} onChange={setGoal} />
      <ReminderTimePicker value={reminder} onChange={setReminder} />
      <TemplateCard selected={withTemplate} onPress={() => setWithTemplate((v) => !v)} />
    </OnboardingStep>
  );
}
