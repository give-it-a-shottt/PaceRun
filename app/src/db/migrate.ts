/** 단계별 스키마 변경을 적용할 대상. 폰에서는 expo-sqlite, 테스트에서는 Node의 SQLite가 이 모양을 맞춘다. */
export type MigrationTarget = {
  /** 지금까지 적용한 단계 수(PRAGMA user_version) */
  getVersion: () => Promise<number>;
  /** 한 단계의 SQL을 실행하고 단계 수를 version으로 올린다. 전부 되거나 전부 안 돼야 한다. */
  applyStep: (sql: string, version: number) => Promise<void>;
};

/**
 * 아직 적용하지 않은 단계만 차례로 적용한다.
 * 중간 단계가 실패하면 거기서 멈추고 오류를 던진다(앞 단계는 적용된 채로 남고, 다음 실행 때 실패한 단계부터 다시 시도한다).
 */
export async function runMigrations(target: MigrationTarget, migrations: readonly string[]): Promise<void> {
  const current = await target.getVersion();
  for (let version = current; version < migrations.length; version++) {
    await target.applyStep(migrations[version], version + 1);
  }
}
