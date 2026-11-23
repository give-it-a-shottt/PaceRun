import { describe, expect, it } from 'vitest';

import { createPartLoader, PartLoadError } from './lazyPart';

describe('createPartLoader', () => {
  it('받아 온 조각을 그대로 돌려준다', async () => {
    const part = { default: 'chart' };
    await expect(createPartLoader(() => Promise.resolve(part)).read()).resolves.toBe(part);
  });

  it('한 번 받기 시작하면 같은 약속을 준다(그릴 때마다 다시 받지 않는다)', () => {
    let calls = 0;
    const loader = createPartLoader(() => {
      calls += 1;
      return Promise.resolve('ok');
    });
    expect(loader.read()).toBe(loader.read());
    expect(calls).toBe(1);
  });

  it('받지 못하면 PartLoadError로 바꿔 던진다', async () => {
    const loader = createPartLoader(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    await expect(loader.read()).rejects.toBeInstanceOf(PartLoadError);
  });

  it('실패를 기억한다: retry 전에는 다시 받지 않는다', async () => {
    let calls = 0;
    const loader = createPartLoader(() => {
      calls += 1;
      return Promise.reject(new Error('끊김'));
    });
    await expect(loader.read()).rejects.toBeInstanceOf(PartLoadError);
    await expect(loader.read()).rejects.toBeInstanceOf(PartLoadError);
    expect(calls).toBe(1);
  });

  it('retry 뒤에는 다시 받아 온다', async () => {
    let calls = 0;
    const loader = createPartLoader(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('끊김')) : Promise.resolve('ok');
    });
    await expect(loader.read()).rejects.toBeInstanceOf(PartLoadError);
    loader.retry();
    await expect(loader.read()).resolves.toBe('ok');
    expect(calls).toBe(2);
  });
});
