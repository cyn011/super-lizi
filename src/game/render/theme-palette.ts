/**
 * game/render/theme-palette — theme → palette 解析器（P-LEVEL-04 biome 氛围接线点）。
 *
 * 读取关卡 LevelData.metadata.theme，返回对应调色板（背景 / 岩壁 / 单向平台 / 终点 tint）。
 * 纯数据、无 Phaser 依赖（仅依赖 core 类型），由 game-scene.drawLevel 消费。
 *
 * 契约对齐：art-director 的 art/cave-biome-spec.md §6 为本解析器的权威接口（THEME_PALETTES /
 * ThemePalette 8 语义槽 + metadata.theme 联合类型取值）。本文件按其 hex 落地。
 *
 *  - 'grass'（默认/1-1）：**刻意保持现有暖色硬编码**（task 红铁律：1-1 不受影响；1-2 已切 mountain=cave 别名）。
 *    注：art 文档 §5/§6.3 建议将草地越界棕迁回锁色板，属未来 reconcile，本任务不动旧关。
 *  - 'cave'（2-1）：冷暗洞穴，hex 全部取自 art/cave-biome-spec.md §6.2 权威映射——
 *    岩壁 #4A78C0 / 描边 #2A1A12 / 火光 #F2933C / 晶体核心 #FFD23F / 辉光 #6E7BF2 /
 *    危险 #E8483B；rockBody(#254060) 与 bg(#1C2E49) 由 #4A78C0 运行时 darken 派生（0 新增色）。
 *  - 'vine_forest'（2-2）：明亮藤林，全锁色板内（附录 A）——草绿 #7CC242 / 阴影绿 #5FA82F /
 *    暖橙 #F2933C / 暖黄 #FFD23F / 描边 #2A1A12 / 蓝紫 #6E7BF2 / 天空 #5BC8F5 / 警示红 #E8483B；0 新增色。
 *  - 'storm_sky'（2-3）：阴沉风暴天空，全锁色板内（附录 A）——蓝紫 #6E7BF2 / 环境冷蓝 #4A78C0 /
 *    天空 #5BC8F5 / 暖橙 #F2933C / 暖黄 #FFD23F / 描边 #2A1A12 / 警示红 #E8483B；0 新增色。
 *
 * 未知 / 缺省 theme 回退 'grass'（fail-safe，保证旧关 / 回归稳定，art §6.1）。
 */
import type { LevelData } from '../../core/level/level-data';

/**
 * 单主题调色板（语义槽 → hex，全部来自锁色板或由其 tint 派生）。
 * 字段名与 art/cave-biome-spec.md §6.2 的 ThemePalette 契约一致，供 game/render 消费。
 */
export interface ThemePalette {
  /** 背景 / 天空填充（null=不绘制背景层，草原关保持原行为）。 */
  bg: number | null;
  /** 岩壁主面（ground_top / 实心瓦片填充）。 */
  rockFace: number;
  /** 岩壁暗面（ground_fill / 单向平台填充）。 */
  rockBody: number;
  /** 全局描边。 */
  outline: number;
  /** 暖橙火光点缀。 */
  firelight: number;
  /** 晶体暖黄核心（凯旋之门填充）。 */
  crystalCore: number;
  /** 晶体辉光（主）。 */
  crystalGlow: number;
  /** 警示红（危险双编码）。 */
  danger: number;
}

/** 草原调色板（与 1-1 现有硬编码色一致，保证零回归；1-2 已切 mountain=cave 别名，不在此处）。 */
const GRASS: ThemePalette = {
  bg: null, // 草原关不绘背景层（保持原行为）
  rockFace: 0x3a2a1f, // 现有瓦片填充（暖棕岩土，越界色但本任务不动旧关）
  rockBody: 0x6a5a3f, // 现有 oneway 填充（暖棕身）
  outline: 0x2a1a12, // 全局描边
  firelight: 0xf2933c, // 暖橙
  crystalCore: 0xf2c94c, // 凯旋之门（暖金）
  crystalGlow: 0x7cc242, // 草绿
  danger: 0xe8483b, // 警示红
};

/**
 * 洞穴调色板（art/cave-biome-spec.md §6.2 权威 hex，锁色板派生，0 新增色）：
 *   岩壁 #4A78C0 / 火光 #F2933C / 晶体核心 #FFD23F / 辉光 #6E7BF2 / 危险 #E8483B / 描边 #2A1A12。
 *   rockBody(#254060) 与 bg(#1C2E49) 由 #4A78C0 运行时 darken 派生（不计入新增 hex）。
 */
const CAVE: ThemePalette = {
  bg: 0x1c2e49, // darken(#4A78C0, 0.38) 派生 tint，0 新增
  rockFace: 0x4a78c0, // 环境冷蓝（锁色板 #10）
  rockBody: 0x254060, // darken(#4A78C0, 0.50) 岩壁暗面，0 新增
  outline: 0x2a1a12, // 描边（锁色板 #5）
  firelight: 0xf2933c, // 暖橙（锁色板 #3）
  crystalCore: 0xffd23f, // 晶体暖黄（锁色板 #4）
  crystalGlow: 0x6e7bf2, // 蓝紫辉光（锁色板 #9，主）
  danger: 0xe8483b, // 警示红（锁色板 #7）
};

/**
 * 藤林调色板（2-2 content-spec 附录 A，锁色板内，0 新增 hex）：
 *   背景 #5BC8F5（森林天光）/ 岩壁 #7CC242（草绿基色）/ 岩壁暗面 #5FA82F（阴影绿）/
 *   描边 #2A1A12 / 暖橙花 #F2933C / 微光 #FFD23F / 辉光 #6E7BF2（冷中藏暖）/ 危险 #E8483B。
 */
const VINE_FOREST: ThemePalette = {
  bg: 0x5bc8f5, // 天空 #5BC8F5（森林天光，锁色板 #11）
  rockFace: 0x7cc242, // 草绿 #7CC242（藤林基色，锁色板 #1）
  rockBody: 0x5fa82f, // 阴影绿 #5FA82F（草体阴影，锁色板 #2）
  outline: 0x2a1a12, // 描边 #2A1A12（锁色板 #5）
  firelight: 0xf2933c, // 暖橙 #F2933C（藤花点缀，锁色板 #3）
  crystalCore: 0xffd23f, // 暖黄 #FFD23F（孢子/微光，锁色板 #4）
  crystalGlow: 0x6e7bf2, // 蓝紫 #6E7BF2（冷中藏暖，锁色板 #9）
  danger: 0xe8483b, // 警示红 #E8483B（仅 ci_li 等，与弹藤友好色解耦）
};

/**
 * 风暴天空调色板（2-3 content-spec 附录 A，锁色板内，0 新增 hex）：
 *   背景 #4A78C0（阴沉天光）/ 岩壁 #6E7BF2（蓝紫风暴岩台）/ 岩壁暗面 #4A78C0（同 bg 冷调）/
 *   描边 #2A1A12 / 闪电 #F2933C / 电光核心 #FFD23F / 辉光 #5BC8F5（冷蓝天光反差）/ 危险 #E8483B。
 */
const STORM_SKY: ThemePalette = {
  bg: 0x4a78c0, // 环境冷蓝 #4A78C0（阴沉天光，锁色板 #10）
  rockFace: 0x6e7bf2, // 蓝紫 #6E7BF2（风暴岩台基色，锁色板 #9）
  rockBody: 0x4a78c0, // 环境冷蓝 #4A78C0（同 bg 冷调，锁色板 #10）
  outline: 0x2a1a12, // 描边 #2A1A12（锁色板 #5）
  firelight: 0xf2933c, // 暖橙 #F2933C（闪电点缀，锁色板 #3）
  crystalCore: 0xffd23f, // 暖黄 #FFD23F（电光核心，锁色板 #4）
  crystalGlow: 0x5bc8f5, // 天空 #5BC8F5（冷蓝天光反差，锁色板 #11）
  danger: 0xe8483b, // 警示红 #E8483B（仅 chong_feng/shi_pao 等，与气旋友好色解耦）
};

/** 调色板注册表（art §6.2 契约：THEME_PALETTES[theme]）。 */
export const THEME_PALETTES: Record<string, ThemePalette> = {
  grass: GRASS,
  cave: CAVE,
  vine_forest: VINE_FOREST,
  storm_sky: STORM_SKY,
  // 山川 mountain = 室外山道版 cave 调色板（art-theme 复用结论：零新资产、零新增 hex）。
  // 1-2 切 mountain 即借用冷蓝岩壁 cave palette，引擎 resolveBiome 自动换肤。
  mountain: CAVE,
};

/** 由 theme 字符串解析调色板（未知 / 缺省回退草原，fail-safe）。 */
export function resolveBiome(theme: string | undefined): ThemePalette {
  if (theme && THEME_PALETTES[theme]) return THEME_PALETTES[theme];
  return GRASS;
}

/** 由关卡数据解析调色板（安全读 metadata.theme）。 */
export function biomeForLevel(data: LevelData): ThemePalette {
  return resolveBiome(data.metadata?.theme);
}
