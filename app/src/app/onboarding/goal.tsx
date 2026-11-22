import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { FlagCheckeredIcon } from '@/components/icons';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { ReminderTimePicker, type ReminderChoice } from '@/components/onboarding/ReminderTimePicker';
import { TemplateCard } from '@/components/onboarding/TemplateCard';
import { WeeklyGoalPicker } from '@/components/onboarding/WeeklyGoalPicker';
import { DEFAULT_REMINDER_CLOCK, parseReminderTime, toReminderTime } from '@/domain/reminderTime';
import { requestNotificationAccess } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';

/** ONB_01_003 Step 3. 주 목표 설정: 주 목표 횟수 · 알림 시간을 고르고 [시작하기]를 누를 때 한 번에 저장한다. */
export default function GoalStep() {
  const savedGoal = useSettingsStore((s) => s.settings.weeklyGoal);
  const savedReminderTime = useSettingsStore((s) => s.settings.reminderTime);
  const update = useSettingsStore((s) => s.update);

  const [goal, setGoal] = useState(savedGoal);
  // 피그마 기본 모양대로 알림은 켠 채(매일 오전 7:00), 템플릿은 고른 채로 연다
  const [reminder, setReminder] = useState<ReminderChoice>(() => ({
    enabled: true,
    clock: parseReminderTime(savedReminderTime) ?? DEFAULT_REMINDER_CLOCK,
  }));
  const [withTemplate, setWithTemplate] = useState(true);

  const [saving, setSaving] = useState(false);
  // 버튼이 로딩으로 바뀌기 전에 한 번 더 눌려도 두 번 저장하지 않게 한다
  const savingRef = useRef(false);

  const start = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const reminderTime = reminder.enabled ? toReminderTime(reminder.clock) : null;
    if (reminderTime) {
      // 저장하면 바로 알림이 예약되므로 그 전에 권한을 묻는다(이미 있으면 창이 뜨지 않는다). 거부해도 진행한다.
      try {
        await requestNotificationAccess();
      } catch (error) {
        console.warn('[onboarding] 알림 권한을 요청하지 못했어요', error);
      }
    }

    await update('weeklyGoal', goal);
    await update('reminderTime', reminderTime);
    await update('onboardingDone', true);

    // update는 저장에 실패하면 값을 되돌리고 토스트를 띄운다. 그때는 이 화면에 남아 다시 누를 수 있게 한다
    // (넘어가 버리면 다음에 앱을 열 때 온보딩이 다시 나온다).
    if (!useSettingsStore.getState().settings.onboardingDone) {
      savingRef.current = false;
      setSaving(false);
      return;
    }

    // replace로 가서 뒤로 가기로 온보딩에 돌아오지 않게 한다. 템플릿 선택 화면(PLN_01_003)은 아직 없어 계획 탭으로 보낸다.
    router.replace(withTemplate ? '/plan' : '/home');
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
