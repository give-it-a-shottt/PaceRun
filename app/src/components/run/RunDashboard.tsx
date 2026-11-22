import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PauseIcon, SpeakerHighIcon, WarningIcon, type IconProps } from '@/components/icons';
import type { RunView } from '@/domain/runView';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space, type ColorName } from '@/theme/tokens';

import { Lane } from './Lane';
import { PaceGauge } from './PaceGauge';
import { RunNow } from './RunNow';
import { Stat, StatRow } from './Stat';

type Props = {
  view: RunView;
  /** 진행 값 저장이 연달아 실패하고 있는지 */
  saveFailing: boolean;
};

const SAVE_FAILING_TEXT = '기록 저장이 잘 안 되고 있어요';

/** 러닝 중 · 일시정지 · GPS 끊김을 같은 배치로 그린다. 받은 값을 그리기만 하고 계산하지 않는다. */
export function RunDashboard({ view, saveFailing }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="body14M" color="textSub" numberOfLines={1} style={styles.title}>
          {view.title}
        </AppText>
        <AppText variant="title16SB" tabular>
          {view.elapsedText}
        </AppText>
      </View>

      <View style={styles.body}>
        {view.paused ? (
          <RunNow
            label="일시정지됨"
            icon={PauseIcon}
            value={view.primaryValue}
            // 저장이 실패하고 있을 때 "저장되고 있어요"라고 말하지 않는다
            secondary={saveFailing ? `${SAVE_FAILING_TEXT}.` : view.pausedText}
          />
        ) : (
          <RunNow label={view.primaryLabel} value={view.primaryValue} secondary={view.secondaryText} />
        )}

        {/* 큰 숫자 묶음과 지표 사이 자리: 인터벌은 레인, 페이스메이커는 게이지 */}
        {view.lane ? <Lane lane={view.lane} /> : null}
        {view.gauge ? <PaceGauge gauge={view.gauge} /> : null}

        <StatRow>
          <Stat value={view.distanceText} label={view.distanceCaption} />
          <Stat value={view.paceText} label={view.paceCaption} />
        </StatRow>

        {view.paused ? null : (
          <>
            <View style={[styles.divider, { backgroundColor: colors.lineLight }]} />
            <View style={styles.notices}>
              {view.lastCue ? (
                <Notice
                  icon={view.gpsLost ? WarningIcon : SpeakerHighIcon}
                  iconColor={view.gpsLost ? 'iconMain' : 'iconSub'}
                  text={`"${view.lastCue}"`}
                />
              ) : null}
              {saveFailing ? <Notice icon={WarningIcon} iconColor="iconMain" text={SAVE_FAILING_TEXT} alert /> : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

type NoticeProps = {
  icon: ComponentType<IconProps>;
  iconColor: ColorName;
  text: string;
  /** 화면 낭독기가 바로 읽어 줘야 하는 경고인지 */
  alert?: boolean;
};

function Notice({ icon: Icon, iconColor, text, alert }: NoticeProps) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole={alert ? 'alert' : undefined} accessibilityLabel={text} style={styles.notice}>
      <Icon size={20} color={colors[iconColor]} />
      <AppText variant="body15R" color="textSub" style={styles.noticeText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: space[3],
  },
  title: { flex: 1 },
  body: {
    flex: 1,
    paddingTop: space[8],
    paddingHorizontal: layout.screenPaddingX,
    gap: space[8],
    overflow: 'hidden',
  },
  divider: { alignSelf: 'stretch', height: 1 },
  notices: { gap: space[3] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  noticeText: { flex: 1 },
});
