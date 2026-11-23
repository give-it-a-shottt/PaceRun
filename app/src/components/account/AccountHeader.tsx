import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CloudArrowUpIcon, UserIcon } from '@/components/icons';
import type { AccountView } from '@/domain/syncView';
import { useTheme } from '@/theme/ThemeContext';
import { layout, radius, space } from '@/theme/tokens';

const AVATAR_SIZE = 48;
const AVATAR_ICON_SIZE = 24;

type Props = {
  view: AccountView;
  /** 계정 연결 · 다시 로그인 버튼을 눌렀을 때(둘 다 로그인 화면으로 간다) */
  onConnect: () => void;
};

/** 내 정보 탭 맨 위의 계정 영역(피그마 11:1370): 로그인 상태 한 줄과, 연결돼 있지 않으면 연결 버튼. */
export function AccountHeader({ view, onConnect }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.account}>
        <View style={[styles.avatar, { backgroundColor: colors.bgRegular }]}>
          <UserIcon size={AVATAR_ICON_SIZE} color={colors.iconSub} />
        </View>
        <View style={styles.text}>
          <AppText variant="title16SB" numberOfLines={1}>
            {view.headerTitle}
          </AppText>
          <AppText variant="caption12R" color="textSub">
            {view.headerSubtitle}
          </AppText>
        </View>
      </View>
      {view.headerAction ? (
        <Button
          label={view.headerAction.label}
          variant="outlineStrong"
          icon={CloudArrowUpIcon}
          iconWeight="regular"
          onPress={onConnect}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[6],
    gap: space[4],
  },
  account: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space[0.5] },
});
