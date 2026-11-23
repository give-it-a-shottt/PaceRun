import { FlagCheckeredIcon, MapPinIcon } from '@phosphor-icons/react';
import { divIcon, latLngBounds } from 'leaflet';
import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import styles from './RouteMap.module.css';

// 지도 안의 치수(px). leaflet에 숫자로 넘겨야 해서 CSS 변수로 둘 수 없다.
/** 출발 · 도착 표시(동그란 바탕)의 지름 */
const PIN_SIZE = 32;
/** 표시 안의 아이콘 */
const PIN_ICON_SIZE = 20;
/** 경로와 지도 가장자리 사이 */
const FIT_PADDING = 40;
/** 도착 표시를 출발 표시 위에 그린다(같은 자리에서 끝나는 러닝이 많다) */
const FINISH_Z_INDEX_OFFSET = 100;

/** 하위 도메인(a · b · c) 없는 주소가 OpenStreetMap이 권하는 주소다 */
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** OpenStreetMap 타일을 쓰는 조건이다. 지우지 않는다. */
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type PinProps = { position: [number, number]; label: string; zIndexOffset?: number; children: ReactNode };

/** 아이콘이 든 동그란 표시. leaflet의 divIcon 안에 React 아이콘을 포털로 그린다(SVG 글자를 따로 만들지 않으려고). */
function Pin({ position, label, zIndexOffset, children }: PinProps) {
  const [holder] = useState(() => {
    const element = document.createElement('div');
    element.className = styles.pinHolder;
    return element;
  });
  const icon = useMemo(
    () =>
      divIcon({
        html: holder,
        className: styles.pin,
        iconSize: [PIN_SIZE, PIN_SIZE],
        iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
      }),
    [holder],
  );

  return (
    <>
      {/* 누를 것이 없는 표시라 키보드 초점은 받지 않는다 */}
      <Marker position={position} icon={icon} title={label} alt={label} keyboard={false} zIndexOffset={zIndexOffset} />
      {createPortal(children, holder)}
    </>
  );
}

/** 러닝 상세의 큰 지도: 경로 선 + 출발 · 도착 표시. 경로 전체가 보이게 맞춘다. path는 점이 2개 이상이어야 한다. */
export default function RouteMap({ path }: { path: [number, number][] }) {
  const bounds = useMemo(() => latLngBounds(path), [path]);

  return (
    <MapContainer
      className={styles.map}
      bounds={bounds}
      boundsOptions={{ padding: [FIT_PADDING, FIT_PADDING] }}
      // 페이지를 내리다가 지도가 확대되지 않게 한다(확대는 +/- 버튼과 두 번 누르기로)
      scrollWheelZoom={false}
    >
      <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
      <Polyline positions={path} pathOptions={{ className: styles.routeLine }} interactive={false} />
      <Pin position={path[0]} label="출발">
        <MapPinIcon size={PIN_ICON_SIZE} aria-hidden />
      </Pin>
      <Pin position={path[path.length - 1]} label="도착" zIndexOffset={FINISH_Z_INDEX_OFFSET}>
        <FlagCheckeredIcon size={PIN_ICON_SIZE} aria-hidden />
      </Pin>
    </MapContainer>
  );
}
