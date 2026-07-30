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

import type { InputMapping } from '../input/input-abstraction';
import type { LevelData } from '../level/level-data';

// ---- 物理常量（E2.S1 / 架构 §10）----
export const TILE = physicsJson.tile as number;
export const GRAVITY = physicsJson.gravity as number;
export const MAX_FALL = physicsJson.maxFall as number;

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
