import { DEFAULT_SETTINGS, type Settings } from './types';

/**
 * DB의 (key, value) 줄들을 설정 객체로 합친다.
 * 저장된 적 없는 키, 모르는 키, JSON이 깨진 값은 기본값으로 둔다.
 */
export function mergeSettings(rows: readonly { key: string; value: string }[]): Settings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      merged[row.key] = JSON.parse(row.value);
    } catch {
      // 깨진 값은 버리고 기본값을 쓴다
    }
  }
  return merged as Settings;
}
