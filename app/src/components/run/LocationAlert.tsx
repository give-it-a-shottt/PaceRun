import { AlertDialog } from '@/components/AlertDialog';
import { openAppSettings, openLocationSettings } from '@/services/permissions';

import type { LocationIssue } from './useStartRun';

const COPY: Record<LocationIssue, { title: string; message: string }> = {
  permission: {
    title: '위치 권한이 필요해요',
    message: "러닝 경로와 거리를 기록하려면 위치 권한을 '항상 허용'으로 바꿔 주세요.",
  },
  services: {
    title: '폰의 위치(GPS)가 꺼져 있어요',
    message: '러닝 경로와 거리를 기록하려면 폰 설정에서 위치를 켜 주세요.',
  },
};

type Props = {
  issue: LocationIssue;
  onClose: () => void;
};

/** RUN_02_002 위치를 쓸 수 없어 시작하지 못할 때의 안내. 문제가 있을 때만 그린다(없으면 렌더하지 않는다). */
export function LocationAlert({ issue, onClose }: Props) {
  const { title, message } = COPY[issue];
  return (
    <AlertDialog
      visible
      title={title}
      message={message}
      onRequestClose={onClose}
      actions={[
        {
          label: '설정 열기',
          onPress: () => {
            onClose();
            // 설정 화면을 열지 못해도 할 수 있는 일이 없어 조용히 넘긴다(창은 이미 닫혔고 다시 [시작]을 누를 수 있다)
            // 권한은 앱 설정 화면에서, GPS 스위치는 폰의 위치 설정 화면에서 켠다
            const open = issue === 'services' ? openLocationSettings : openAppSettings;
            open().catch(() => undefined);
          },
        },
        { label: '나중에', onPress: onClose },
      ]}
    />
  );
}
