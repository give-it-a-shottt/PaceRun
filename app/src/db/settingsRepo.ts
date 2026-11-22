import { mergeSettings } from '@/domain/settings';
import type { Settings } from '@/domain/types';

import { getDb } from './database';

/** 저장된 값이 없거나 읽을 수 없는 키는 기본값으로 채워 돌려준다. */
export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return mergeSettings(rows);
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}
