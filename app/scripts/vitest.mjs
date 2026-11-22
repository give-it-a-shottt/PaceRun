// 윈도우에서 드라이브 문자가 소문자(c:\...)인 경로로 vitest를 실행하면
// 같은 모듈이 두 번 읽혀 "Cannot read properties of undefined (reading 'config')"로 실패한다.
// 드라이브 문자를 대문자로 바꾼 경로에서 vitest를 다시 띄운다. (Admin_Docs/troubleshooting/T-001)
import { spawnSync } from 'node:child_process';

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
