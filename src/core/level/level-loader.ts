/**
 * core/level/level-loader — 关卡加载（GDD 05，E4.S1 落地）。
 *
 * 解析并校验关卡 JSON → 构建 RuntimeLevel（CollisionWorld + spawn + goal AABB + entities）。
 * 纯 TS，零 Phaser / 零平台依赖（core 铁律）。
 */
import type { LevelData } from './level-data';
import { validateLevelData } from './level-data';
import { RuntimeLevel } from './level-runtime';

export class LevelLoader {
  /** 解析并校验关卡 JSON；校验失败抛错（E4.S1 扩展报错细节）。 */
  static load(json: unknown): RuntimeLevel {
    if (!validateLevelData(json)) {
      throw new Error('LevelData 校验失败（E4.S1 最小校验）');
    }
    return new RuntimeLevel(json as LevelData);
  }
}
