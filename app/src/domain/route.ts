/**
 * 러닝 경로를 작은 그림 상자 안에 그릴 선으로 바꾼다(지도 타일 없이 경로 선만 그린다 — D-008).
 * 위도 · 경도를 평면 좌표로 옮기고, 가로세로 비율을 지킨 채 상자 가운데에 맞춘다.
 */

export type RoutePosition = { lat: number; lng: number };
export type RouteBox = { width: number; height: number; padding: number };

export type RouteShape = {
  /** SVG path의 d 값: "M12.0 80.5 L14.2 78.1 …" */
  path: string;
  /** 출발 · 도착 지점(상자 안의 좌표) */
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** 선을 그릴 점의 최대 수. 이보다 많으면 고르게 솎는다(화면에서는 차이가 보이지 않는다) */
const MAX_DRAWN_POINTS = 200;
/** 경로가 이 크기(미터)보다 작으면 그리지 않는다(제자리에서 잡힌 GPS 흔들림을 경로처럼 보이게 하지 않는다) */
const MIN_SPAN_M = 20;
const METERS_PER_DEGREE = 111_320;

/** 그릴 수 없으면 null: 점이 2개 미만이거나 움직인 범위가 너무 작을 때 */
export function projectRoute(points: readonly RoutePosition[], box: RouteBox): RouteShape | null {
  if (points.length < 2) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  // 경도 1도의 실제 길이는 위도에 따라 줄어든다. 가운데 위도로 맞춰야 경로가 옆으로 늘어나 보이지 않는다.
  const lngScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLng - minLng) * lngScale;
  const spanY = maxLat - minLat;
  if (Math.max(spanX, spanY) * METERS_PER_DEGREE < MIN_SPAN_M) return null;

  const innerWidth = Math.max(1, box.width - box.padding * 2);
  const innerHeight = Math.max(1, box.height - box.padding * 2);
  // 한쪽 범위가 0이어도(곧은 길) 나누기 오류가 나지 않게 한다
  const scale = Math.min(spanX > 0 ? innerWidth / spanX : Infinity, spanY > 0 ? innerHeight / spanY : Infinity);
  const offsetX = (box.width - spanX * scale) / 2;
  const offsetY = (box.height - spanY * scale) / 2;

  const project = (point: RoutePosition) => ({
    x: offsetX + (point.lng - minLng) * lngScale * scale,
    // 화면의 y는 아래로 갈수록 커지므로 북쪽(위도가 큰 쪽)을 위에 둔다
    y: offsetY + (maxLat - point.lat) * scale,
  });

  const drawn = thin(points, MAX_DRAWN_POINTS).map(project);
  const path = drawn.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return { path, start: drawn[0], end: drawn[drawn.length - 1] };
}

/** 점을 고르게 솎는다. 처음과 끝 점은 반드시 남긴다. */
function thin<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  const kept: T[] = [];
  for (let index = 0; index < max; index++) kept.push(points[Math.round(index * step)]);
  return kept;
}
