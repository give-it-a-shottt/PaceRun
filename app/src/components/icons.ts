/**
 * 앱에서 쓰는 Phosphor 아이콘을 한곳에서 내보낸다.
 *
 * 'phosphor-react-native' 입구(index)에서 가져오면 아이콘 1,500여 개가 전부 번들에 들어간다
 * (Expo의 번들러는 안 쓰는 코드를 기본으로 걸러 내지 않는다). 그래서 아이콘 파일을 하나씩 가져온다.
 * 새 아이콘이 필요하면 여기에 한 줄 추가하고, 화면에서는 이 파일에서만 가져온다.
 */
export type { IconProps } from 'phosphor-react-native';

export { BatteryWarningIcon } from 'phosphor-react-native/src/icons/BatteryWarning';
export { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
export { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
export { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
export { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
export { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
export { CheckIcon } from 'phosphor-react-native/src/icons/Check';
export { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
export { FlagCheckeredIcon } from 'phosphor-react-native/src/icons/FlagCheckered';
export { GpsSlashIcon } from 'phosphor-react-native/src/icons/GpsSlash';
export { HouseIcon } from 'phosphor-react-native/src/icons/House';
export { InfoIcon } from 'phosphor-react-native/src/icons/Info';
export { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
export { LockSimpleIcon } from 'phosphor-react-native/src/icons/LockSimple';
export { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
export { MetronomeIcon } from 'phosphor-react-native/src/icons/Metronome';
export { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
export { PauseIcon } from 'phosphor-react-native/src/icons/Pause';
export { PersonSimpleRunIcon } from 'phosphor-react-native/src/icons/PersonSimpleRun';
export { PlayIcon } from 'phosphor-react-native/src/icons/Play';
export { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
export { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
export { StopIcon } from 'phosphor-react-native/src/icons/Stop';
export { TimerIcon } from 'phosphor-react-native/src/icons/Timer';
export { TrendUpIcon } from 'phosphor-react-native/src/icons/TrendUp';
export { UserIcon } from 'phosphor-react-native/src/icons/User';
export { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
