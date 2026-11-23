import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { leaveAccountScreen, openLogin } from '@/components/account/accountNav';
import { SyncNotice } from '@/components/account/SyncNotice';
import { useAccountView } from '@/components/account/useAccountView';
import { AlertDialog } from '@/components/AlertDialog';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CloudArrowUpIcon, InfoIcon, LockSimpleIcon, WarningIcon } from '@/components/icons';
import { TextLink } from '@/components/run/TextLink';
import { useAndroidBack } from '@/components/run/useAndroidBack';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { logOut } from '@/services/session';
import { syncNow } from '@/services/sync';
import { useTheme } from '@/theme/ThemeContext';
import { layout, radius, space } from '@/theme/tokens';

const STATUS_ICON_BOX = 48;
const STATUS_ICON_SIZE = 24;
const ROW_HEIGHT = 56;
const LOCK_ICON_SIZE = 16;

/** MY_01_002 동기화 상태: 계정 연결 상태, 마지막 동기화, 폰에만 있는 기록 수. 글자는 모두 describeAccount가 만든다. */
export default function SyncStatusScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const view = useAccountView();
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // 확인 창이 닫히는 사이에 한 번 더 눌려도 두 번 로그아웃하지 않게 한다
  const loggingOutRef = useRef(false);
  // 제스처 바는 34로 충분하지만, 3버튼 내비게이션 바는 더 높아서 버튼이 가려지지 않게 넓힌다
  const paddingBottom = Math.max(layout.bottomSafePadding, insets.bottom + space[2]);

  // 폰의 뒤로 가기도 상단 뒤로 가기와 같게 한다(돌아갈 화면이 없을 때 앱이 닫히지 않게)
  useAndroidBack(leaveAccountScreen);

  const handlePrimary = () => {
    // syncNow는 던지지 않는다. 진행 · 결과는 authStore를 거쳐 view.busy · problemNote로 돌아온다.
    if (view.primaryAction.kind === 'sync') void syncNow({ download: true });
    else openLogin();
  };

  const askLogOut = () => {
    if (!loggingOutRef.current) setConfirmingLogOut(true);
  };

  const handleLogOut = async () => {
    setConfirmingLogOut(false);
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    try {
      // 끝나면 이 화면에 그대로 머문다(연결 안 된 상태로 바뀐다)
      await logOut();
    } finally {
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  };

  return (
    <Screen>
      <TopBar variant="back" title="동기화 상태" onBack={leaveAccountScreen} />

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.bgLight }]}>
          <View style={[styles.statusIcon, { backgroundColor: colors.bgRegular }]}>
            <CloudArrowUpIcon size={STATUS_ICON_SIZE} color={colors.iconMain} />
          </View>
          <AppText variant="title18SB" accessibilityRole="header">
            {view.statusTitle}
          </AppText>
          <AppText variant="body14R" color="textSub">
            {view.statusBody}
          </AppText>
        </View>

        <View>
          <ValueRow title="마지막 동기화" value={view.lastSyncText} />
          <ValueRow title="이 폰에만 있는 기록" value={view.localOnlyText} />
        </View>

        {view.problemNote || view.unsendableNote ? (
          <View style={styles.notices}>
            {view.problemNote ? <SyncNotice icon={WarningIcon} message={view.problemNote} /> : null}
            {view.unsendableNote ? <SyncNotice icon={InfoIcon} message={view.unsendableNote} /> : null}
          </View>
        ) : null}

        <View style={styles.lockNote}>
          <LockSimpleIcon size={LOCK_ICON_SIZE} color={colors.iconSub} />
          <AppText variant="caption12R" color="textSub" style={styles.flex}>
            같은 기록이 두 번 올라가지 않게 기록마다 고유 번호를 붙여요.
          </AppText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom }]}>
        <Button
          label={view.primaryAction.label}
          loading={view.busy}
          disabled={loggingOut}
          onPress={handlePrimary}
        />
        {view.canLogOut ? (
          <View style={styles.logOut}>
            <TextLink label="로그아웃" onPress={askLogOut} />
          </View>
        ) : null}
      </View>

      <AlertDialog
        visible={confirmingLogOut}
        title="로그아웃할까요?"
        message="기록은 이 폰에 그대로 남아요. 다시 로그인하면 이어서 올라가요."
        actions={[
          { label: '로그아웃', onPress: () => void handleLogOut() },
          { label: '취소', onPress: () => setConfirmingLogOut(false) },
        ]}
        onRequestClose={() => setConfirmingLogOut(false)}
      />
    </Screen>
  );
}

/**
 * 값만 보여 주는 줄. 피그마는 설정 행(꺾쇠 있음)으로 그렸지만 누를 곳이 없어서 꺾쇠 없이 그린다
 * (ListRow에는 누르지 않는 모양이 없다).
 */
function ValueRow({ title, value }: { title: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${title}, ${value}`} style={styles.row}>
      <AppText variant="body16R" style={styles.flex}>
        {title}
      </AppText>
      <AppText variant="body15R" color="textSub" numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[4],
    gap: space[6],
  },
  card: {
    alignItems: 'flex-start',
    paddingHorizontal: space[5],
    paddingVertical: space[6],
    borderRadius: radius.card,
    gap: space[3],
  },
  statusIcon: {
    width: STATUS_ICON_BOX,
    height: STATUS_ICON_BOX,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  notices: { gap: space[2] },
  lockNote: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  footer: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  logOut: { alignItems: 'center' },
});
