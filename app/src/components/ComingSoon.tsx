import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Screen } from './Screen';
import { TopBar } from './TopBar';

/** 아직 만들지 않은 탭 화면의 자리 표시. 해당 기능을 만들면서 지운다. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <Screen>
      <TopBar variant="title" title={title} />
      <View style={styles.body}>
        <AppText color="textSub">준비 중이에요</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
