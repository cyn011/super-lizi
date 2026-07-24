/**
 * tests/unit/save/save-data.test.ts — 存档模型 + 版本化迁移（S05-3，core 零平台可单测）。
 *
 * 仅验证 SaveData 模型与 SaveManager.load 的迁移/回退语义（零 Phaser / 零平台 API），
 * 用内存 MockStoragePort 模拟 storage（不触达 localStorage / wx）。
 */
import { describe, it, expect } from 'vitest';
import { SaveManager, defaultSaveData, type StoragePort } from '../../../src/core/meta/save-data';

/** 内存 StoragePort 实现（测试用，不触达任何平台存储）。 */
class MockStorage implements StoragePort {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  /** 测试辅助：直接写入原始 JSON 串（模拟旧档 / 损坏档）。 */
  seedRaw(key: string, raw: string): void {
    this.map.set(key, raw);
  }
}

const KEY = 'super-mali-save';

describe('SaveData 模型（S05-3）', () => {
  it('defaultSaveData：version=1、首关 1-1 默认解锁、其余记录为空', () => {
    const d = defaultSaveData();
    expect(d.version).toBe(1);
    expect(d.unlockedLevels).toEqual(['1-1']);
    expect(d.ranks).toEqual({});
    expect(d.bestTimes).toEqual({});
    expect(d.bestCoins).toEqual({});
    expect(d.seedMeta).toEqual({ totalCollected: 0, maturity: 0, unlockedStages: ['sprout'], currentStage: 'sprout' });
  });

  it('空 storage → load 返回 defaultSaveData 等价副本', () => {
    const m = new SaveManager(new MockStorage());
    expect(m.load()).toEqual(defaultSaveData());
  });

  it('损坏 JSON → 回退 defaultSaveData（不抛、不残留 stars）', () => {
    const s = new MockStorage();
    s.seedRaw(KEY, '{ this is not valid json');
    const m = new SaveManager(s);
    expect(m.load()).toEqual(defaultSaveData());
  });

  it('旧档无 version 且含 stars → 映射为 ranks 并置 version=1（G5 一致性）', () => {
    const s = new MockStorage();
    s.seedRaw(
      KEY,
      JSON.stringify({
        unlockedLevels: ['1-1'],
        stars: { '1-1': 2, '1-2': 3 },
        bestTimes: { '1-1': 50000 },
      }),
    );
    const m = new SaveManager(s);
    const d = m.load();
    expect(d.version).toBe(1);
    expect(d.ranks).toEqual({ '1-1': 2, '1-2': 3 });
    expect(d.bestTimes).toEqual({ '1-1': 50000 });
    // 不应再出现旧字段 stars
    expect((d as unknown as Record<string, unknown>).stars).toBeUndefined();
  });

  it('当前版本存档（version=1 + 全字段）原样还原，bestCoins 保留', () => {
    const s = new MockStorage();
    const full = {
      version: 1,
      unlockedLevels: ['1-1', '1-2'],
      ranks: { '1-1': 3 },
      bestTimes: { '1-1': 42000 },
      bestCoins: { '1-1': 9 },
      seedMeta: { totalCollected: 0, maturity: 0, unlockedStages: ['sprout'], currentStage: 'sprout' },
    };
    s.seedRaw(KEY, JSON.stringify(full));
    const m = new SaveManager(s);
    expect(m.load()).toEqual(full);
  });

  it('当前版本存档缺 bestCoins 字段 → 以默认空对象补全（向后兼容）', () => {
    const s = new MockStorage();
    s.seedRaw(
      KEY,
      JSON.stringify({ version: 1, unlockedLevels: ['1-1'], ranks: {}, bestTimes: {} }),
    );
    const m = new SaveManager(s);
    const d = m.load();
    expect(d.bestCoins).toEqual({});
    expect(d.version).toBe(1);
  });
});
