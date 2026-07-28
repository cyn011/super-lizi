/**
 * tests/unit/save/save-manager.test.ts — 通关落盘行为（S05-3，core 零平台可单测）。
 *
 * 覆盖 recordClear 的「历史最优」合并、跨会话 reload 一致、解锁下一关推导，
 * 全部用内存 MockStoragePort（零 Phaser / 零平台 API）。
 */
import { describe, it, expect } from 'vitest';
import { SaveManager, type StoragePort, type RankResult } from '../../../src/core/meta/save-data';

/** 内存 StoragePort 实现（测试用，不触达任何平台存储）。 */
class MockStorage implements StoragePort {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** 快速构造 RankResult（未指定项给 S05-2 完成即得的下限）。 */
function makeResult(over: Partial<RankResult> = {}): RankResult {
  return {
    ranks: 1,
    timeMet: false,
    coinMet: false,
    coinRate: 0,
    elapsedMs: 0,
    collectedCoins: 0,
    ...over,
  };
}

describe('SaveManager.recordClear（S05-3）', () => {
  it('取各指标历史最优：ranks/bestCoins 取大、bestTimes 取小（最快=最优）', () => {
    const m = new SaveManager(new MockStorage());
    m.recordClear('1-1', makeResult({ ranks: 2, elapsedMs: 50000, collectedCoins: 5 }));
    m.recordClear('1-1', makeResult({ ranks: 1, elapsedMs: 30000, collectedCoins: 8 }));
    m.recordClear('1-1', makeResult({ ranks: 3, elapsedMs: 90000, collectedCoins: 3 }));

    const d = m.load();
    expect(d.ranks['1-1']).toBe(3); // 取大
    expect(d.bestTimes['1-1']).toBe(30000); // 取小（最快）
    expect(d.bestCoins['1-1']).toBe(8); // 取大
  });

  it('跨会话 reload 一致：新 SaveManager 读同一 storage 还原全部成绩', () => {
    const s = new MockStorage();
    const m1 = new SaveManager(s);
    m1.recordClear('1-1', makeResult({ ranks: 3, elapsedMs: 41000, collectedCoins: 7 }));

    const m2 = new SaveManager(s); // 模拟重新启动
    const d = m2.load();
    expect(d.version).toBe(1);
    expect(d.ranks['1-1']).toBe(3);
    expect(d.bestTimes['1-1']).toBe(41000);
    expect(d.bestCoins['1-1']).toBe(7);
  });

  it('首次通关即标记已通关（ranks≥1），默认 unlockedLevels 保留首关', () => {
    const m = new SaveManager(new MockStorage());
    m.recordClear('1-1', makeResult({ ranks: 1 }));
    const d = m.load();
    expect(d.ranks['1-1']).toBe(1);
    expect(d.unlockedLevels).toEqual(['1-1']);
  });

  describe('解锁下一关（levelOrder 注入）', () => {
    it('注入静态关卡顺序时，通关解锁下一关（去重，不越级）', () => {
      const s = new MockStorage();
      const m = new SaveManager(s, 'libao-da-maoxian-save', ['1-1', '1-2', '1-3']);
      m.recordClear('1-1', makeResult());

      const d = m.load();
      expect(d.unlockedLevels).toContain('1-1'); // 默认
      expect(d.unlockedLevels).toContain('1-2'); // 解锁下一关
      expect(d.unlockedLevels).not.toContain('1-3'); // 不越级

      // 重复通关 1-1 不应重复加入 1-2
      m.recordClear('1-1', makeResult());
      expect(m.load().unlockedLevels.filter((x) => x === '1-2')).toHaveLength(1);
    });

    it('通关末关不解锁（无下一关，已解锁状态保持）', () => {
      const s = new MockStorage();
      const m = new SaveManager(s, 'libao-da-maoxian-save', ['1-1', '1-2']);
      m.recordClear('1-1', makeResult()); // 先清 1-1 → 解锁 1-2
      m.recordClear('1-2', makeResult()); // 清末关 1-2 → 无下一关可解锁
      const d = m.load();
      expect(d.unlockedLevels).toContain('1-1');
      expect(d.unlockedLevels).toContain('1-2'); // 由清 1-1 解锁，保持
      expect(d.unlockedLevels).not.toContain('1-3'); // 末关不越级
    });

    it('未注入 levelOrder 时仅记录成绩、不解锁（首关默认解锁保留）', () => {
      const m = new SaveManager(new MockStorage()); // 无 levelOrder
      m.recordClear('1-1', makeResult({ ranks: 2 }));
      const d = m.load();
      expect(d.unlockedLevels).toEqual(['1-1']);
    });
  });

  describe('S06 进度链契约（与注册表 LEVEL_ORDER 对齐）', () => {
    it('注入 ["1-1","1-2"]，通关 1-1 后 unlockedLevels 含 1-2（去重）', () => {
      const m = new SaveManager(new MockStorage(), 'libao-da-maoxian-save', ['1-1', '1-2']);
      m.recordClear('1-1', makeResult({ ranks: 2, elapsedMs: 41000, collectedCoins: 7 }));
      m.recordClear('1-1', makeResult({ ranks: 3 })); // 重复清 1-1 不应重复加入 1-2
      const d = m.load();
      expect(d.unlockedLevels).toContain('1-1');
      expect(d.unlockedLevels).toContain('1-2');
      expect(d.unlockedLevels.filter((x) => x === '1-2')).toHaveLength(1);
    });

    it('无 levelOrder（旧调用签名）行为不变：仅记录成绩、不解锁', () => {
      const m = new SaveManager(new MockStorage()); // 旧调用：不传关卡顺序
      m.recordClear('1-1', makeResult({ ranks: 2 }));
      const d = m.load();
      expect(d.unlockedLevels).toEqual(['1-1']);
    });
  });
});
