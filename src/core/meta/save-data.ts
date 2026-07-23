/**
 * core/meta/save-data — 元循环 / 存档模型（GDD 11，E1.S3 骨架）。
 * 仅定义模型与 StoragePort 接口；具体读写经 platform.storage 注入（铁律：core 不直连存储实现）。
 */
export interface SaveData {
  unlockedLevels: string[];
  stars: Record<string, number>;
  bestTimes: Record<string, number>;
}

/** 存储端口：由 platform 层实现（Web / 微信端存储）。 */
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function defaultSaveData(): SaveData {
  return { unlockedLevels: ['1-1'], stars: {}, bestTimes: {} };
}

export class SaveManager {
  constructor(
    private readonly storage: StoragePort,
    private readonly key = 'super-mali-save',
  ) {}

  load(): SaveData {
    const raw = this.storage.get(this.key);
    if (!raw) return defaultSaveData();
    try {
      return JSON.parse(raw) as SaveData;
    } catch {
      return defaultSaveData();
    }
  }

  save(data: SaveData): void {
    this.storage.set(this.key, JSON.stringify(data));
  }
}
