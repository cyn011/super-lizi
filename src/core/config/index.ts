/**
 * core/config — 集中配置的类型化读取入口（架构 §10）。
 * 所有可调数值来自 src/config/*.json（真理源），逻辑层经此读取，禁止硬编码。
 * 本模块为纯 TS，零 Phaser / 零平台依赖。
 */
import physicsJson from '../../config/physics-config.json';
import characterJson from '../../config/character-config.json';
import enemyJson from '../../config/enemy-config.json';
import economyJson from '../../config/economy-config.json';
import damageJson from '../../config/damage-config.json';
import inputJson from '../../config/input-config.json';
import uiJson from '../../config/ui-config.json';
import audioJson from '../../config/audio-config.json';
import attackJson from '../../config/attack-config.json';
import level1_1Json from '../../config/levels/1-1.json';
import level1_2Json from '../../config/levels/1-2.json';
import level1_3Json from '../../config/levels/1-3.json';
import level1_4Json from '../../config/levels/1-4.json';
import level1_5Json from '../../config/levels/1-5.json';
import level1_6Json from '../../config/levels/1-6.json';
import level1_7Json from '../../config/levels/1-7.json';
import level2_1Json from '../../config/levels/2-1.json';
import level2_2Json from '../../config/levels/2-2.json';
import level2_3Json from '../../config/levels/2-3.json';
import level2_4Json from '../../config/levels/2-4.json';
import level2_5Json from '../../config/levels/2-5.json';
import level2_6Json from '../../config/levels/2-6.json';
import level3_1Json from '../../config/levels/3-1.json';
import level3_2Json from '../../config/levels/3-2.json';
import level3_3Json from '../../config/levels/3-3.json';
import level3_4Json from '../../config/levels/3-4.json';
import level3_5Json from '../../config/levels/3-5.json';
import level3_6Json from '../../config/levels/3-6.json';
import level4_1Json from '../../config/levels/4-1.json';

import type { InputMapping } from '../input/input-abstraction';
import type { LevelData } from '../level/level-data';

// ---- 物理常量（E2.S1 / 架构 §10）----
export const TILE = physicsJson.tile as number;
export const GRAVITY = physicsJson.gravity as number;
export const MAX_FALL = physicsJson.maxFall as number;
/**
 * 羽降（glide）下落速度上限（px/s，GDD level-3-1-design §4.4）。
 * 仅当关卡 `mechanics.glide === true` 且玩家处于下落段并持续按住跳跃键时，取代全局 MAX_FALL(900)。
 * 初值 140 = moveSpeed(140) → 轨迹恰为 45° 斜降，玩家凭直觉可预判落点（可读性设计），
 * 并与 3-1 的四连金币教学弧（y 步进 24px/格）斜率精确匹配。**QA 调校入口即本常量。**
 */
export const GLIDE_MAX_FALL = physicsJson.glideMaxFall as number;
/**
 * 羽降激活阈值（px/s）：仅当 vy > 此值（= 已在下落段）才钳制，保护上升段的短跳手感
 * （短跳发生在松开沿、上升段；羽降发生在下落中的持续按住，时序不重叠，GDD §4.3 无冲突证明）。
 */
export const GLIDE_ACTIVATE_VY = physicsJson.glideActivateVy as number;

// ---- 固定步长（ADR-005）----
export const STEP_MS = 1000 / 60;
export const STEP_DT = STEP_MS / 1000;

// ---- 各系统配置（直接透传 JSON，强类型由消费方断言）----
export const physicsConfig = physicsJson;
export const characterConfig = characterJson;
export const enemyConfig = enemyJson;
export const economyConfig = economyJson;
export const damageConfig = damageJson;
export const inputConfig = inputJson as {
  web: { left: string[]; right: string[]; jump: string[]; action: string[]; throw: string[] };
  wechat: {
    layout: string;
    buttons: Record<string, { x: number; y: number; r: number }>;
    controlPanel?: { y0: number };
    pauseIcon?: { x: number; y: number; r: number };
    gesture?: Record<string, number>;
  };
};
export const uiConfig = uiJson;
export const audioConfig = audioJson;
/** 扔栗子机制配置（GDD 17 §6.1，集中可调，零硬编码）。 */
export const attackConfig = attackJson;
export const level1_1 = level1_1Json;

// ---- 关卡注册表（S06 进度链）：id → LevelData，单一事实来源；game-scene 经此按 currentLevelId 取关 ----
export const levels: Record<string, LevelData> = {
  '1-1': level1_1Json as LevelData,
  '1-2': level1_2Json as LevelData,
  '1-3': level1_3Json as LevelData,
  '1-4': level1_4Json as LevelData,
  '1-5': level1_5Json as LevelData,
  '1-6': level1_6Json as LevelData,
  '1-7': level1_7Json as LevelData,
  '2-1': level2_1Json as LevelData,
  '2-2': level2_2Json as LevelData,
  '2-3': level2_3Json as LevelData,
  '2-4': level2_4Json as LevelData,
  '2-5': level2_5Json as LevelData,
  '2-6': level2_6Json as LevelData,
  '3-1': level3_1Json as LevelData,
  '3-2': level3_2Json as LevelData,
  '3-3': level3_3Json as LevelData,
  '3-4': level3_4Json as LevelData,
  '3-5': level3_5Json as LevelData,
  // 3-6《星穹终启》= 第三章终章，全项目唯一 theme:'zenith'（破晓穹顶）。
  // ⚠️ 其 theme 必须同时存在于 level-data.ts 的 LevelTheme 与 theme-palette.ts 的 THEME_PALETTES，
  //    否则 resolveBiome() 会静默回退 grass（validateLevelData 不校验 theme 枚举）。
  '3-6': level3_6Json as LevelData,
  // 4-1《拾掷回声》= 第四章 opener，刻意复用最老的 theme:'grass'（叙事「回响」：回到玩家
  // 最后一次见到 chestnut 的地方，见 level-4-1-design §1.2）。纯数据落地，零引擎改动。
  '4-1': level4_1Json as LevelData,
};
/** 静态关卡顺序（进度链）：决定「下一关」推导与解锁顺序，首关默认解锁。 */
export const LEVEL_ORDER: string[] = [
  '1-1',
  '1-2',
  '1-3',
  '1-4',
  '1-5',
  '1-6',
  '1-7',
  '2-1',
  '2-2',
  '2-3',
  '2-4',
  '2-5',
  // 2-6 为第二章终章；3-1 起进入第三章（星界 astral + 新机制羽降 glide）。
  '2-6',
  // 第三章（星界 astral + 羽降 glide）：3-1 开篇「浮空初息」→ 3-2 深化 A 空间轴「星隙长渡」
  // → 3-3 深化 B 时间轴「鸣星回阶」→ 3-4 深化 C 代价轴「陨雨回廊」→ 3-5 高压前奏 链式轴「凌霄绝息」
  // → 3-6 终章 四轴混编 gauntlet「星穹终启」（破晓穹顶 zenith）。
  '3-1',
  '3-2',
  '3-3',
  '3-4',
  '3-5',
  '3-6',
  // 第四章（翠野 grass 回响 + 旧动词「投」唤醒）：4-1 开篇「拾掷回声」。
  // 4-1《拾掷回声》当前为 LEVEL_ORDER **最后一个元素**：
  // 使 nextLevelId('3-6')==='4-1'、nextLevelId('4-1')===null → 结算页对 4-1 隐藏「下一关」。
  // 将来建 4-2 时插到 '4-1' 之后（并同步更新各 loader 测试里硬编码的 LEVEL_ORDER 期望数组）。
  '4-1',
];

// ---- 输入映射（双端归一，GDD 01 §6 / E2.S2）----
// Web：物理信号 = 键码。
export const webInputConfig: InputMapping = {
  left: inputConfig.web.left,
  right: inputConfig.web.right,
  jump: inputConfig.web.jump,
  action: inputConfig.web.action,
  throw: inputConfig.web.throw,
};
// 微信：物理信号 = 虚拟按钮 id（由 wechat-touch 产出）。
// - action 按钮（touch:action）→ INPUT_THROW（扔栗子，GDD 17 §5.1）
// - 暂停图标（touch:pause，由 wechat-touch 命中 pauseIcon 产出）→ INPUT_ACTION（暂停）
export const wechatInputConfig: InputMapping = {
  left: ['touch:left'],
  right: ['touch:right'],
  jump: ['touch:jump'],
  action: ['touch:pause'],
  throw: ['touch:action'],
};

// ---- 聚合（供调试/快照）----
export const GameConfig = {
  step: { ms: STEP_MS, dt: STEP_DT },
  tile: TILE,
  gravity: GRAVITY,
  maxFall: MAX_FALL,
};
