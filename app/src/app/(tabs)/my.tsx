import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Screen } from '@/components/Screen';
import { CadenceSheet } from '@/components/settings/CadenceSheet';
import { ListRow } from '@/components/settings/ListRow';
import { ReminderNotice } from '@/components/settings/ReminderNotice';
import { ReminderSheet } from '@/components/settings/ReminderSheet';
import { RunThemeSheet } from '@/components/settings/RunThemeSheet';
import { Band, SettingsSection } from '@/components/settings/SettingsSection';
import { useSettingsView } from '@/components/settings/useSettingsView';
import { VoiceIntervalSheet } from '@/components/settings/VoiceIntervalSheet';
import { WeeklyGoalSheet } from '@/components/settings/WeeklyGoalSheet';
import { TopBar } from '@/components/TopBar';
import { openAppSettings, openBatterySettings } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';
import { space } from '@/theme/tokens';

/** 값을 고치는 시트. 한 번에 하나만 열린다. */
type SheetKey = 'weeklyGoal' | 'reminder' | 'voiceInterval' | 'cadence' | 'runTheme';

/** MY_01_001 내 정보 · 설정. 바꾸면 바로 저장한다([저장] 버튼이 없다). */
export default function MyScreen() {
  const { view, recheckNotifications } = useSettingsView();
  const update = useSettingsStore((s) => s.update);
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  const close = () => setSheet(null);

  return (
    <Screen>
      <TopBar variant="title" title="내 정보" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {/* F-010: 계정 영역(로그인 상태 · [계정 연결하고 웹에서 보기])과 그 아래 Band가 여기에 들어간다 */}

        <SettingsSection title="러닝 목표">
          <ListRow type="value" title="주 목표" value={view.weeklyGoalText} onPress={() => setSheet('weeklyGoal')} />
          <ListRow type="value" title="알림 시간" value={view.reminderText} onPress={() => setSheet('reminder')} />
          {view.reminderNotice ? (
            <ReminderNotice message={view.reminderNotice} onOpenSettings={() => void openAppSettings()} />
          ) : null}
        </SettingsSection>

        <Band />
        <SettingsSection title="음성 안내">
          <ListRow
            type="toggle"
            title="음성 안내"
            value={view.voiceEnabled}
            onChange={(enabled) => void update('voiceEnabled', enabled)}
          />
          <ListRow
            type="value"
            title="안내 간격"
            value={view.voiceIntervalText}
            onPress={() => setSheet('voiceInterval')}
          />
          <ListRow type="value" title="기본 발걸음 박자" value={view.cadenceText} onPress={() => setSheet('cadence')} />
        </SettingsSection>

        <Band />
        <SettingsSection title="화면">
          <ListRow type="value" title="러닝 화면 테마" value={view.runThemeText} onPress={() => setSheet('runTheme')} />
        </SettingsSection>

        <Band />
        <SettingsSection title="기록">
          {/* F-010: "동기화 상태" 행이 여기(배터리 최적화 확인 위)에 들어간다 */}
          <ListRow type="link" title="배터리 최적화 확인" onPress={() => void openBatterySettings()} />
        </SettingsSection>
      </ScrollView>

      <WeeklyGoalSheet visible={sheet === 'weeklyGoal'} onClose={close} />
      <ReminderSheet visible={sheet === 'reminder'} onClose={close} onNotificationsAsked={recheckNotifications} />
      <VoiceIntervalSheet visible={sheet === 'voiceInterval'} onClose={close} />
      <CadenceSheet visible={sheet === 'cadence'} onClose={close} valueText={view.cadenceText} />
      <RunThemeSheet visible={sheet === 'runTheme'} onClose={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: space[6] },
});
