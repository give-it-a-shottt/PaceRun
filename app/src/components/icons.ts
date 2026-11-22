/**
 * 앱에서 쓰는 Phosphor 아이콘을 한곳에서 내보낸다.
 *
 * 'phosphor-react-native' 입구(index)에서 가져오면 아이콘 1,500여 개가 전부 번들에 들어간다
 * (Expo의 번들러는 안 쓰는 코드를 기본으로 걸러 내지 않는다). 그래서 아이콘 파일을 하나씩 가져온다.
 * 새 아이콘이 필요하면 여기에 한 줄 추가하고, 화면에서는 이 파일에서만 가져온다.
 */
export type { IconProps } from 'phosphor-react-native';

export { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
export { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
export { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
export { HouseIcon } from 'phosphor-react-native/src/icons/House';
export { UserIcon } from 'phosphor-react-native/src/icons/User';
