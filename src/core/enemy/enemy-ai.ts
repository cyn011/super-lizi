/**
 * core/enemy/enemy-ai — 敌人 AI（GDD 04 §3，E3.S1/S2 表驱动状态机 + HazardSource）。
 *
 * 零 Phaser / 零平台 API（core 铁律）。每实例对应关卡一个敌人实体。
 * 行为表（参数全部来自 enemy-config.json，禁止硬编码）：
 *   ci_li      → patrol：水平巡逻 speed，遇边缘（前方无地）或墙掉头；可踩。
 *   du_fu      → float ：原地正弦浮动（float=峰值竖直速度，amp=振幅）；可踩。
 *   chong_feng → idle→detect（玩家在 detect 内且高度差<attackRange）→charge（朝玩家直线
 *                chargeSpeed）→wallHit（撞墙 stun=stunMs 回 idle）；不可踩（踩它玩家受伤）。
 *                stun 期 non-hazard（sprint plan §1.2，可被安全越过）。
 *   shi_pao    → 定时 fireInterval 朝玩家方向 fire 生成 Projectile（独立 hazard）；不可踩。
 *
 * 复用 C3 的 HazardSource 接口接入 damage-resolution；可踩时额外实现 StompableHazard
 * （getBounds / markStomped）供踩踏顶触判定。chong_feng / shi_pao 实现 HazardSource 且
 * isStompable=false → 走「玩家受伤」分支（原 C3 逻辑，本 Story 不消灭敌人）。
 *
 * update(dt, world, player?) 返回本步由 shi_pao 产出的 Projectile[]（空数组表示无产出），
 * 交由 game-scene 管理弹丸列表。
 *
 * EnemyState 取 GDD 04 §5 规范类型（enemy-types.ts），本模块通过 toState() 暴露快照。
 */
import type { Body } from '../physics/body';
import type { CollisionWorld } from '../physics/collision';
import type { HazardSource, StompableHazard } from '../damage/hazard-source';
import type { EnemyState, EnemyTypeName } from './enemy-types';
import { enemyConfig } from '../config';
import { Projectile } from './projectile';
import {
  DEFAULT_GU_BAO_CFG,
  guBaoProgress,
  resolveGuBaoPhase,
  stepGuBao,
  type GuBaoCfg,
  type GuBaoState,
} from './gu-bao';
import {
  DEFAULT_BOUNCY_VINE_CFG,
  resolveBouncyVinePower,
  stepBouncyVine,
  type BouncyVineCfg,
  type BouncyVineState,
} from './bouncy-vine';
import {
  DEFAULT_CYCLONE_CFG,
  applyCycloneForce,
  stepCyclone,
  type CycloneCfg,
} from './cyclone';
import { applyFloat } from './float-math';
import {
  DEFAULT_DU_FU_SILHOUETTE_CFG,
  createDufuSilhouetteState,
  stepDufuSilhouette,
  type DufuSilhouetteCfg,
  type DufuSilhouetteGhost,
  type DufuSilhouetteState,
  type DufuSilhouetteTwist,
} from './dufu-silhouette';

/** 单类敌人参数（全部来自 enemy-config.json，禁止硬编码）。 */
export interface EnemyConfigEntry {
  /** ci_li 巡逻水平速度（px/s）。 */
  speed?: number;
  /** du_fu 正弦浮速：峰值竖直速度（px/s）。 */
  float?: number;
  /** du_fu 振幅（px）。 */
  amp?: number;
  /** chong_feng：检测水平半径（px），玩家中心水平距 ≤ detect 才进入 detect。 */
  detect?: number;
  /** chong_feng：冲锋水平速度（px/s）。 */
  chargeSpeed?: number;
  /** chong_feng：撞墙眩晕时长（ms），眩晕结束回 idle。 */
  stun?: number;
  /** chong_feng：检测垂直容差（px），高度差 < attackRange 才触发 detect（GDD 04：<48）。 */
  attackRange?: number;
  /** shi_pao：开火间隔（ms），每 fireInterval 朝玩家发射一枚弹丸。 */
  fireInterval?: number;
  /** shi_pao：弹丸速度（px/s），fire 时按朝向注入。 */
  projSpeed?: number;
  /** 是否可踩消灭。 */
  stompable: boolean;
  /** 触手/侧身是否不造成伤害（水母 jellyfish：仅踏脚石，侧身无害）。 */
  nonDamaging?: boolean;
  /** 被踩是否仅弹起、不被消灭（水母 jellyfish：持久踏脚石）。 */
  persistentStomp?: boolean;
  /** 碰撞盒宽（px）。 */
  width: number;
  /** 碰撞盒高（px）。 */
  height: number;
}

const DEFAULT_ENEMY_W = 24;
const DEFAULT_ENEMY_H = 24;

/** 共享的空弹丸数组哨兵：update 非开火时返回它，避免每步新建空数组（候选④ GC 优化，只读不写）。 */
const NO_PROJECTILES: Projectile[] = [];

/**
 * 敌人 AI 实例（E3.S1）。一个实例 = 关卡一个敌人实体。
 * 表驱动：update 按 type 分派到对应行为；新增敌人类型只需扩表 + 扩 createEnemies。
 */
export class EnemyAI implements StompableHazard {
  readonly id: number;
  readonly type: EnemyTypeName;
  /** 可踩标记：旧 4 敌为静态 cfg 值；gu_bao 随态动态赋值（仅 RETRACTING=true）。 */
  isStompable: boolean;
  /** 触手/侧身不造成伤害（水母 jellyfish：仅踏脚石，侧身无害）。 */
  nonDamaging: boolean;
  /** 被踩仅弹起、不被消灭（水母 jellyfish：持久踏脚石，区别于 du_fu 踩杀）。 */
  persistentStomp: boolean;
  readonly enemyType: string;
  /** 碰撞盒宽 / 高（px）：旧 4 敌恒定；gu_bao 高度随升起进度 p 变化（DORMANT=0）。 */
  width: number;
  height: number;

  /** 当前位置 / 速度（世界坐标，px / px·s⁻¹）。 */
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** 状态名（'patrol' | 'float' | 'idle' | 'dead'），供调试/未来序列化。 */
  state: string;
  /** 是否已消灭（消灭后不再作为 hazard）。 */
  dead = false;

  private readonly cfg: EnemyConfigEntry;
  private dir: 1 | -1 = 1; // 巡逻/冲锋方向（初始向右）
  private readonly baseY: number; // 嘟浮基准 y
  private phase = 0; // 嘟浮相位
  /** chong_feng 眩晕剩余（ms）。 */
  private stunTimer = 0;
  /** shi_pao 开火计时（ms），累计到 fireInterval 触发一次 fire。 */
  private fireTimer = 0;
  /** shi_pao 开火口闪光计时（ms，仅视觉，由 game-scene 渲染读取）。 */
  private fireFlash = 0;
  /** shi_pao 最近一次瞄准方向（单位向量，默认朝左=玩家来向）；fire 时更新。 */
  private aimX = -1;
  private aimY = 0;

  // ── gu_bao 周期状态机字段（GDD 13，零平台纯逻辑）──
  /** gu_bao 当前态（DORMANT/EMERGING/ACTIVE/RETRACTING）。 */
  private guBaoState: GuBaoState = 'DORMANT';
  /** gu_bao 当前态已用时间（ms），供 stepGuBao 续推。 */
  private guBaoT = 0;
  /** gu_bao 升起进度 0..1（盒顶相对 anchorY 的上移比例）。 */
  private guBaoP = 0;
  /** gu_bao 当前态是否危害（仅 render/调试用，hazard 判定走 overlaps + isStompable）。 */
  private guBaoHazard = false;
  /** gu_bao 地面锚点（苞自此处升起；盒底恒贴 anchorY）。 */
  private guBaoAnchorY = 0;
  /** gu_bao 本实例状态机数值（enemy-config.gu_bao + per-instance params 覆盖）。 */
  private guBaoCfg: GuBaoCfg = DEFAULT_GU_BAO_CFG;

  // ── bouncy_vine 三态状态机字段（GDD 14，零平台纯逻辑）──
  /** 弹藤本实例状态机数值（enemy-config.bouncy_vine + per-instance params.power 覆盖）。 */
  private vineCfg: BouncyVineCfg = DEFAULT_BOUNCY_VINE_CFG;
  /** 弹藤地面锚点（苞自此处贴地；盒底恒贴 anchorY）。 */
  private vineAnchorY = 0;
  /** 弹藤当前态（IDLE/SPRING/RECOIL）。 */
  private vineState: BouncyVineState = 'IDLE';
  /** 弹藤当前态已用时间（ms）。 */
  private vineT = 0;
  /** 弹藤压缩/回弹进度 0..1（render 读：线圈高度 / 顶踩提示）。 */
  private vineP = 0;
  /** 本步是否触发回弹（justFired）；集成层读后套用弹起速度 + 发 ON_BOUNCE。 */
  private vineJustBounced = false;
  /** 上一帧玩家是否与藤顶接触（落地下降边沿检测：仅首帧触发）。 */
  private prevVineContact = false;
  /** 已含 power 倍率的弹起速度（px/s，向上为负）。 */
  private vineBounceVelocity = 0;

  // ── cyclone 上升气流力场字段（GDD 15，零平台纯逻辑）──
  /** 气旋本实例力场数值（enemy-config.cyclone + per-instance params 覆盖）。 */
  private cycloneCfg: CycloneCfg = DEFAULT_CYCLONE_CFG;
  /** 气旋地面锚点（气柱自此处向上延伸 cycloneCfg.height）。 */
  private cycloneAnchorY = 0;
  /** 气柱顶 y（= cycloneAnchorY - cycloneCfg.height）；bbox = [cx-w/2, cx+w/2] × [top, top+h]。 */
  private cycloneTop = 0;
  /** 气柱中心 x（= colLeft + width/2）。 */
  private cycloneCx = 0;
  /** 漩涡相位（仅视觉，时间推进）。 */
  private cyclonePhase = 0;
  /** 本帧玩家是否在气柱内（render 读：气柱高亮）。 */
  private cycloneInZoneFlag = false;

  // ── du_fu_silhouette 剪影状态机字段（GDD 16，零平台纯逻辑）──
  /** 剪影本实例状态机数值（enemy-config.du_fu_silhouette + per-instance params 覆盖）。 */
  private silCfg: DufuSilhouetteCfg = DEFAULT_DU_FU_SILHOUETTE_CFG;
  /** 剪影运行时状态（stepDufuSilhouette 纯函数推进，零平台）。 */
  private silState: DufuSilhouetteState = createDufuSilhouetteState(
    DEFAULT_DU_FU_SILHOUETTE_CFG,
    0,
    0,
  );

  constructor(
    type: EnemyTypeName,
    x: number,
    y: number,
    id: number,
    config: typeof enemyConfig = enemyConfig,
    params?: Record<string, number>,
  ) {
    this.type = type;
    this.id = id;
    this.enemyType = type;
    this.cfg = config[type] as EnemyConfigEntry;
    this.isStompable = this.cfg.stompable;
    this.nonDamaging = this.cfg.nonDamaging ?? false;
    this.persistentStomp = this.cfg.persistentStomp ?? false;
    this.width = this.cfg.width ?? DEFAULT_ENEMY_W;
    this.height = this.cfg.height ?? DEFAULT_ENEMY_H;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.state =
      type === 'ci_li'
        ? 'patrol'
        : type === 'du_fu' || type === 'jellyfish'
          ? 'float'
          : 'idle';

    // gu_bao：地面锚点 = y；按 phaseOffset 推导初始态；盒顶随 p 上移。
    if (type === 'gu_bao') {
      this.guBaoAnchorY = y;
      this.guBaoCfg = buildGuBaoCfg(this.cfg, params);
      const init = resolveGuBaoPhase(params?.phaseOffset ?? 0, this.guBaoCfg);
      this.guBaoState = init.state;
      this.guBaoT = init.t;
      this.guBaoP = guBaoProgress(init.state, init.t, this.guBaoCfg);
      this.width = this.guBaoCfg.width;
      this.height = this.guBaoP * this.guBaoCfg.height;
      this.y = this.guBaoAnchorY - this.height; // 盒顶（DORMANT: 等于 anchorY，地下零高）
      this.state = init.state;
      this.isStompable = init.state === 'RETRACTING';
    }

    // bouncy_vine：地面锚点 = y；盒底贴 anchorY，盒顶 = anchorY - height；全态无害、非可踩。
    if (type === 'bouncy_vine') {
      this.vineAnchorY = y;
      this.vineCfg = buildBouncyVineCfg(this.cfg, params);
      this.vineState = 'IDLE';
      this.vineT = 0;
      this.vineP = 0;
      this.width = this.vineCfg.width;
      this.height = this.vineCfg.height;
      this.y = this.vineAnchorY - this.height; // 盒顶（贴地线圈）
      this.state = 'IDLE';
      this.isStompable = false; // 纯辅助，非击杀型
      this.vineBounceVelocity = this.vineCfg.bounceVelocity; // 已含 power 倍率（向上为负）
    }

    // cyclone：地面锚点 = y；气柱自 anchorY 向上延伸 height（bbox=[cx-w/2,cx+w/2]×[top,top+h]）。
    if (type === 'cyclone') {
      this.cycloneAnchorY = y;
      this.cycloneCfg = buildCycloneCfg(this.cfg, params);
      this.cycloneTop = this.cycloneAnchorY - this.cycloneCfg.height;
      this.cycloneCx = x + this.cycloneCfg.width / 2;
      this.cyclonePhase = 0;
      this.cycloneInZoneFlag = false;
      this.width = this.cycloneCfg.width;
      this.height = this.cycloneCfg.height;
      this.x = x; // 气柱左
      this.y = this.cycloneTop; // 气柱顶
      this.state = 'idle';
      this.isStompable = false; // 非实体、非踩
    }

    // du_fu_silhouette：暗色镜像浮动敌（GDD 16）。复用 du_fu 浮动数学 + 反相/诱饵/幽灵 twist。
    if (type === 'du_fu_silhouette') {
      this.silCfg = buildSilhouetteCfg(this.cfg, params);
      this.silState = createDufuSilhouetteState(this.silCfg, x, y, params);
      this.width = this.silCfg.width;
      this.height = this.silCfg.height;
      this.x = this.silState.x;
      this.y = this.silState.y; // 初始 = baseY（mirror/phaseghost 下一步浮动）
      this.state = this.silState.mode; // 'FLOAT'(mirror) / 'IDLE'(decoy)
      this.isStompable = this.silState.stompable;
    }
  }

  /** 当前碰撞盒（供碰撞解算 / HazardSource.overlaps）。 */
  getBody(): Body {
    return { x: this.x, y: this.y, w: this.width, h: this.height, vx: this.vx, vy: this.vy };
  }

  /** StompableHazard：供 damage-resolution 做「玩家底触敌顶」判定。 */
  getBounds(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  /** GDD 04 §5 EnemyState 快照（调试 / 未来序列化）。 */
  toState(): EnemyState {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      hp: 1,
      state: this.state,
      stompable: this.isStompable,
      dead: this.dead,
    };
  }

  /** 当前朝向（1=右 / -1=左），渲染楔形前尖 / 眼睛用。 */
  get facing(): 1 | -1 {
    return this.dir;
  }

  /** 最近一次瞄准方向（单位向量），渲染炮口朝向用。 */
  get aim(): { x: number; y: number } {
    return { x: this.aimX, y: this.aimY };
  }

  /** 触手/侧身是否无害（水母 jellyfish：true ⇒ damage-resolution 跳过受伤分支）。 */
  get isNonDamaging(): boolean {
    return this.nonDamaging;
  }

  /** 被踩是否仅弹起、不被消灭（水母 jellyfish：true ⇒ 持久踏脚石）。 */
  get isPersistentStomp(): boolean {
    return this.persistentStomp;
  }

  /** 浮动相位（rad，du_fu / jellyfish 正弦浮动用），渲染伞盖 pulse 读取。 */
  get floatPhase(): number {
    return this.phase;
  }

  /** 开火口闪光剩余（ms），>0 时渲染炮口闪光。 */
  get flash(): number {
    return this.fireFlash;
  }

  /** gu_bao 当前态（render / 调试读：危险刺 vs 软顶）。 */
  get guBaoPhaseState(): GuBaoState {
    return this.guBaoState;
  }

  /** gu_bao 升起进度 0..1（render 读：苞体高度 / 尖刺收起）。 */
  get guBaoProgress(): number {
    return this.guBaoP;
  }

  /** bouncy_vine 当前态（render / 调试读：线圈相位）。 */
  get vinePhaseState(): BouncyVineState {
    return this.vineState;
  }

  /** bouncy_vine 压缩/回弹进度 0..1（render 读：线圈高度 / 顶踩提示）。 */
  get vineProgress(): number {
    return this.vineP;
  }

  /** 本步是否触发回弹（game-scene 读：套用弹起速度 + 发 ON_BOUNCE）。 */
  get justBounced(): boolean {
    return this.vineJustBounced;
  }

  /** 已含 power 倍率的弹起速度（px/s，向上为负）；game-scene 套用 body.vy。 */
  get bounceVelocity(): number {
    return this.vineBounceVelocity;
  }

  /** cyclone 漩涡相位 0..2π（render 读：气柱旋转动画）。 */
  get cyclonePhaseState(): number {
    return this.cyclonePhase;
  }

  /** cyclone 本帧是否在气柱内（render 读：气柱高亮）。 */
  get cycloneInZone(): boolean {
    return this.cycloneInZoneFlag;
  }

  /** 剪影幽灵子态（render 读：WRAITH 期半透）。 */
  get silGhostState(): DufuSilhouetteGhost {
    return this.silState.ghost;
  }

  /** 剪影行为扭曲类型（render 读：phaseghost 才需半透处理）。 */
  get silTwist(): DufuSilhouetteTwist {
    return this.silState.twist;
  }

  /** 剪影配对光嘟浮实例 id（render / 调试读）。 */
  get silPairId(): number {
    return this.silState.pairId;
  }

  /**
   * 每固定步推进（dt 秒）。死亡敌人不再更新。
   * @param player 玩家碰撞盒（chong_feng detect / shi_pao aim 需要；ci_li/du_fu 可省）。
   * @returns 本步由 shi_pao 产出的弹丸（无则空数组）。
   */
  update(dt: number, world: CollisionWorld, player?: Body): Projectile[] {
    if (this.dead) return [];
    if (this.fireFlash > 0) this.fireFlash = Math.max(0, this.fireFlash - dt * 1000);
    if (this.type === 'ci_li') {
      this.updatePatrol(dt, world);
      return NO_PROJECTILES;
    }
    if (this.type === 'du_fu' || this.type === 'jellyfish') {
      this.updateFloat(dt);
      return NO_PROJECTILES;
    }
    if (this.type === 'gu_bao') {
      this.updateGuBao(dt);
      return NO_PROJECTILES;
    }
    if (this.type === 'bouncy_vine') {
      this.updateBouncyVine(dt, player);
      return NO_PROJECTILES;
    }
    if (this.type === 'cyclone') {
      this.updateCyclone(dt, player);
      return NO_PROJECTILES;
    }
    if (this.type === 'du_fu_silhouette') {
      this.updateSilhouette(dt, player);
      return NO_PROJECTILES;
    }
    if (this.type === 'chong_feng') return this.updateChongFeng(dt, world, player);
    if (this.type === 'shi_pao') return this.updateShiPao(dt, player);
    return NO_PROJECTILES;
  }

  // ── ci_li 巡逻：先探测前方边缘/墙，再移动（避免穿墙 / 掉坑）──
  private updatePatrol(dt: number, world: CollisionWorld): void {
    const speed = this.cfg.speed ?? 0;
    const frontX = this.dir > 0 ? this.x + this.width + 1 : this.x - 1;
    const footY = this.y + this.height + 1; // 脚前下方探地（边缘检测）
    const wallY = this.y + this.height / 2; // 身前中部探墙
    const groundAhead = this.isSolidAt(world, frontX, footY);
    const wallAhead = this.isSolidAt(world, frontX, wallY);
    if (!groundAhead || wallAhead) this.dir = (this.dir * -1) as 1 | -1;
    this.x += this.dir * speed * dt;
    this.vx = this.dir * speed;
  }

  // ── du_fu 正弦浮动：复用共享纯函数 applyFloat（与 du_fu_silhouette 同一套浮动数学，phaseOffset=0）──
  // omega = floatSpeed / amp（rad/s），峰值竖直速度 = floatSpeed（数值全来自 config）。
  private updateFloat(dt: number): void {
    const floatSpeed = this.cfg.float ?? 0;
    const amp = this.cfg.amp ?? 0;
    const res = applyFloat(
      { baseY: this.baseY, amp, float: floatSpeed, phase: this.phase },
      dt,
      this.x,
      0,
    );
    this.phase = res.phase;
    this.y = res.y;
    this.vy = res.vy;
    this.vx = 0;
  }

  // ── gu_bao 周期状态机（GDD 13）：DORMANT→EMERGING→ACTIVE→RETRACTING→(DORMANT) ──
  // 盒底恒贴 guBaoAnchorY；盒顶随升起进度 p 上移；危害仅 EMERGING/ACTIVE；可踩仅 RETRACTING。
  // 几何与危害/可踩全部由 stepGuBao 纯函数推导，本方法仅把结果落到实例字段（零平台）。
  private updateGuBao(dt: number): void {
    const res = stepGuBao(this.guBaoState, this.guBaoT, dt, this.guBaoCfg);
    this.guBaoState = res.state;
    this.guBaoT = res.t;
    this.guBaoP = res.p;
    const h = res.p * this.guBaoCfg.height; // 当前盒高（DORMANT=0）
    this.height = h;
    this.y = this.guBaoAnchorY - h; // 盒顶（anchorY - p*height）
    this.width = this.guBaoCfg.width; // 宽恒定
    this.state = res.state;
    this.isStompable = res.stompable; // 仅 RETRACTING=true → 踩杀管线
    this.guBaoHazard = res.hazard;
  }

  // ── bouncy_vine 三态状态机（GDD 14）：IDLE→SPRING→RECOIL→(IDLE) ──
  // 落地下降边沿触发：玩家底触藤顶且 vy>=0 且与上帧未接触 → contact → SPRING（当帧 justFired）。
  // justFired 由集成层（game-scene）消费：套用 body.vy = -bounceVelocity + 发 ON_BOUNCE（零计分）。
  // 几何与危害/可踩全部由 stepBouncyVine 纯函数推导，本方法仅把结果落到实例字段（零平台）。
  private updateBouncyVine(dt: number, player?: Body): void {
    this.vineJustBounced = false;
    let contact = false;
    if (player) {
      const vineTop = this.y; // 盒顶（anchorY - height）
      const bottom = player.y + player.h;
      const overlapX = player.x < this.x + this.width && player.x + player.w > this.x;
      const bottomTouch = bottom >= vineTop - 4 && bottom <= vineTop + this.height + 8;
      const contactNow = player.vy >= 0 && overlapX && bottomTouch;
      contact = contactNow && !this.prevVineContact; // 仅落地下降边沿（防站藤上自动反复弹）
      this.prevVineContact = contactNow;
    }
    const res = stepBouncyVine(this.vineState, this.vineT, dt, this.vineCfg, contact);
    this.vineState = res.state;
    this.vineT = res.t;
    this.vineP = res.p;
    this.state = res.state;
    this.isStompable = false; // 纯辅助，全态非可踩
    if (res.justFired) this.vineJustBounced = true;
  }

  // ── cyclone 上升气流力场（GDD 15）：玩家位于气柱内 → 施加向上加速度（净向上）+ 钳速 ──
  // 纯力场（非实体、非可踩、hazard=false）；直接改写传入的 player 速度（player 即玩家 body，
  // 由 game-scene 在 stepBody 后传入，零平台、无全局状态）。
  private updateCyclone(dt: number, player?: Body): void {
    if (!player) return;
    const res = stepCyclone(
      this.cycloneCfg,
      player,
      dt,
      this.cyclonePhase,
      this.cycloneCx,
      this.cycloneTop,
    );
    this.cyclonePhase = res.phase;
    this.cycloneInZoneFlag = res.inZone;
    applyCycloneForce(res, player, dt, this.cycloneCfg.riseMax);
  }

  // ── du_fu_silhouette 剪影（GDD 16）：镜像/诱饵/幽灵 twist，全部由 stepDufuSilhouette 纯函数推导 ──
  // decoy 激活：集成层每帧把玩家邻近布尔写入 silState.playerProximity（零平台，仅布尔）。
  // 几何与危害/可踩全部由 stepDufuSilhouette 纯函数推导，本方法仅把结果落到实例字段（零平台）。
  private updateSilhouette(dt: number, player?: Body): void {
    if (this.silState.twist === 'decoy' && player) {
      const pcx = player.x + player.w / 2;
      const pcy = player.y + player.h / 2;
      const ecx = this.x + this.width / 2;
      const ecy = this.y + this.height / 2;
      this.silState.playerProximity = Math.hypot(pcx - ecx, pcy - ecy) <= this.silState.decoyTriggerDist;
    }
    const res = stepDufuSilhouette(this.silState, dt);
    this.silState = res.state;
    this.x = this.silState.x;
    this.y = this.silState.y;
    this.vy = this.silState.vy;
    this.vx = 0;
    this.state = this.silState.mode; // FLOAT / IDLE
    this.isStompable = this.silState.stompable; // SOLID/mirror=true，WRAITH/decoy-IDLE=false
  }

  // ── chong_feng 冲锋：idle 探测玩家 → charge 直线冲锋 → 撞墙 stun → 回 idle ──
  // detect：玩家中心水平距 ≤ detect 且垂直差 < attackRange（GDD 04：高度差 <48）。
  // charge：朝锁定方向 chargeSpeed 直线；前方（CollisionWorld 实体 tile 或越界封边）阻挡 → stun。
  // stun：静止 stunMs，归零回 idle（stun 期 overlaps 返回 false → non-hazard，sprint plan §1.2）。
  private updateChongFeng(dt: number, world: CollisionWorld, player?: Body): Projectile[] {
    if (this.state === 'idle') {
      this.vx = 0;
      if (player) {
        const dx = player.x + player.w / 2 - (this.x + this.width / 2);
        const dy = player.y + player.h / 2 - (this.y + this.height / 2);
        const detect = this.cfg.detect ?? 0;
        const vRange = this.cfg.attackRange ?? 0;
        if (Math.abs(dx) <= detect && Math.abs(dy) <= vRange) {
          this.dir = dx >= 0 ? 1 : -1;
          this.state = 'charge';
          this.vx = this.dir * (this.cfg.chargeSpeed ?? 0); // 立即起步冲锋（同帧进入 charge）
        }
      }
    } else if (this.state === 'charge') {
      const speed = this.cfg.chargeSpeed ?? 0;
      this.vx = this.dir * speed;
      this.x += this.vx * dt; // 直线冲锋（固定 y，不计入重力，符合「朝玩家方向直线」）
      const frontX = this.dir > 0 ? this.x + this.width + 1 : this.x - 1;
      const midY = this.y + this.height / 2;
      if (this.isSolidAt(world, frontX, midY)) {
        this.state = 'stun';
        this.stunTimer = this.cfg.stun ?? 0;
        this.vx = 0;
      }
    } else if (this.state === 'stun') {
      this.vx = 0;
      this.stunTimer -= dt * 1000;
      if (this.stunTimer <= 0) {
        this.state = 'idle';
        this.stunTimer = 0;
      }
    }
    return NO_PROJECTILES;
  }

  // ── shi_pao 固定炮台：定时 fireInterval 朝玩家方向发射一枚 Projectile（独立 hazard）──
  // 静态 turret（vx/vy=0）；fireTimer 累计到 fireInterval 且有玩家目标时 fire，
  // 重置计时并产出朝玩家归一化方向 × projSpeed 的弹丸。无玩家目标不发射（避免盲射）。
  private updateShiPao(dt: number, player?: Body): Projectile[] {
    this.vx = 0;
    this.vy = 0;
    this.state = 'idle'; // 静态炮台，状态每帧复位（仅 fire 当帧闪烁）
    this.fireTimer += dt * 1000;
    const interval = this.cfg.fireInterval ?? Infinity;
    if (this.fireTimer >= interval && player) {
      this.fireTimer = 0;
      this.state = 'fire';
      this.fireFlash = 120; // 仅视觉闪光
      const pcx = this.x + this.width / 2;
      const pcy = this.y + this.height / 2;
      const tx = player.x + player.w / 2;
      const ty = player.y + player.h / 2;
      let dx = tx - pcx;
      let dy = ty - pcy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      this.aimX = dx;
      this.aimY = dy;
      const speed = this.cfg.projSpeed ?? 0;
      // 炮口外推一点出生，避免与炮台自身重叠误伤
      const mx = pcx + dx * (this.width / 2 + 2);
      const my = pcy + dy * (this.height / 2 + 2);
      return [Projectile.acquire(mx, my, dx * speed, dy * speed)];
    }
    return NO_PROJECTILES;
  }

  private isSolidAt(world: CollisionWorld, px: number, py: number): boolean {
    const ts = world.tileSize;
    const tx = Math.floor(px / ts);
    const ty = Math.floor(py / ts);
    return world.isSolidTile(tx, ty);
  }

  // ── HazardSource 实现 ──
  overlaps(body: Body): boolean {
    if (this.dead) return false; // 已消灭：不再作为 hazard
    // bouncy_vine / cyclone：纯辅助力场，hazard=false；其交互（回弹 / 托起）由 stepSim 单独处理，
    // 不进伤害管线（避免误伤 / 误踩）。overlaps 恒 false 保证零危害。
    if (this.type === 'bouncy_vine' || this.type === 'cyclone') return false;
    if (this.type === 'gu_bao' && this.guBaoState === 'DORMANT') return false; // 地下无碰撞、无害
    if (this.type === 'du_fu_silhouette') {
      // 危害期（mirror FLOAT / decoy FLOAT / phaseghost SOLID）才参与碰撞；
      // decoy IDLE 与 phaseghost WRAITH 期可穿越（overlaps=false，纯视觉暗影）。
      if (!this.silState.hazard) return false;
      return this.aabbHit(body);
    }
    if (this.state === 'stun') return false; // chong_feng 眩晕期 non-hazard（可被安全越过）
    return this.aabbHit(body);
  }

  /** AABB 相交检测（与玩家 body 重叠）。 */
  private aabbHit(body: Body): boolean {
    return (
      body.x < this.x + this.width &&
      body.x + body.w > this.x &&
      body.y < this.y + this.height &&
      body.y + body.h > this.y
    );
  }

  knockbackDir(body: Body): 1 | -1 {
    return body.x + body.w / 2 < this.x + this.width / 2 ? 1 : -1;
  }

  /** 被踩消灭：标记死亡，overlaps 随即返回 false，场景跳过（从世界移除）。 */
  markStomped(): void {
    this.dead = true;
    this.state = 'dead';
  }

  /**
   * 栗子打断冲锋（GDD 17 §7）：chong_feng 被栗子命中 → 进入 stun 状态 `ms` 毫秒（与撞墙 stun 同态）。
   * 仅对 chong_feng 生效（其余敌人不进 stun 态）；已死亡忽略。stun 期 overlaps 返回 false（non-hazard，安全越过）。
   */
  applyStun(ms: number): void {
    if (this.dead || this.type !== 'chong_feng') return;
    this.state = 'stun';
    this.stunTimer = ms;
    this.vx = 0;
  }
}

/**
 * 由 enemy-config 的 gu_bao 项 + 每实例 params 构建 GuBaoCfg（数值全来自 config，禁止硬编码）。
 * params 可覆盖：dormantMs / activeMs / height / width（GDD 13 §3.2）；phaseOffset 由构造单独消费。
 */
function buildGuBaoCfg(raw: EnemyConfigEntry, params?: Record<string, number>): GuBaoCfg {
  const r = raw as unknown as Partial<GuBaoCfg>;
  const base: GuBaoCfg = {
    dormantMs: r.dormantMs ?? DEFAULT_GU_BAO_CFG.dormantMs,
    emergeMs: r.emergeMs ?? DEFAULT_GU_BAO_CFG.emergeMs,
    activeMs: r.activeMs ?? DEFAULT_GU_BAO_CFG.activeMs,
    retractMs: r.retractMs ?? DEFAULT_GU_BAO_CFG.retractMs,
    height: r.height ?? DEFAULT_GU_BAO_CFG.height,
    width: r.width ?? DEFAULT_GU_BAO_CFG.width,
  };
  if (!params) return base;
  return {
    dormantMs: params.dormantMs ?? base.dormantMs,
    emergeMs: base.emergeMs,
    activeMs: params.activeMs ?? base.activeMs,
    retractMs: base.retractMs,
    height: params.height ?? base.height,
    width: params.width ?? base.width,
  };
}

/**
 * 由 enemy-config 的 bouncy_vine 项 + 每实例 params 构建 BouncyVineCfg（数值全来自 config，禁止硬编码）。
 * params.power（数值倍率：normal=1.0 / strong=1.2 / weak=0.8）作用于 bounceVelocity；
 * params 亦可覆盖 bounceVelocity / width / height / springMs / recoilMs（GDD 14 §3.2/§4）。
 */
function buildBouncyVineCfg(raw: EnemyConfigEntry, params?: Record<string, number>): BouncyVineCfg {
  const r = raw as unknown as Partial<BouncyVineCfg>;
  const power = resolveBouncyVinePower(params);
  const base: BouncyVineCfg = {
    bounceVelocity: (r.bounceVelocity ?? DEFAULT_BOUNCY_VINE_CFG.bounceVelocity) * power,
    springMs: r.springMs ?? DEFAULT_BOUNCY_VINE_CFG.springMs,
    recoilMs: r.recoilMs ?? DEFAULT_BOUNCY_VINE_CFG.recoilMs,
    width: r.width ?? DEFAULT_BOUNCY_VINE_CFG.width,
    height: r.height ?? DEFAULT_BOUNCY_VINE_CFG.height,
    hazard: r.hazard ?? false,
  };
  if (!params) return base;
  return {
    ...base,
    bounceVelocity: (params.bounceVelocity ?? base.bounceVelocity),
    width: params.width ?? base.width,
    height: params.height ?? base.height,
    springMs: params.springMs ?? base.springMs,
    recoilMs: params.recoilMs ?? base.recoilMs,
  };
}

/**
 * 由 enemy-config 的 cyclone 项 + 每实例 params 构建 CycloneCfg（数值全来自 config，禁止硬编码）。
 * params 可覆盖气柱尺寸与强度：w / h / liftAcc / riseMax / dragX（GDD 15 §3.2）。
 */
function buildCycloneCfg(raw: EnemyConfigEntry, params?: Record<string, number>): CycloneCfg {
  const r = raw as unknown as Partial<CycloneCfg>;
  const base: CycloneCfg = {
    liftAcc: r.liftAcc ?? DEFAULT_CYCLONE_CFG.liftAcc,
    riseMax: r.riseMax ?? DEFAULT_CYCLONE_CFG.riseMax,
    dragX: r.dragX ?? DEFAULT_CYCLONE_CFG.dragX,
    width: r.width ?? DEFAULT_CYCLONE_CFG.width,
    height: r.height ?? DEFAULT_CYCLONE_CFG.height,
    phaseSpeed: r.phaseSpeed ?? DEFAULT_CYCLONE_CFG.phaseSpeed,
    hazard: r.hazard ?? false,
  };
  if (!params) return base;
  return {
    ...base,
    liftAcc: params.liftAcc ?? base.liftAcc,
    riseMax: params.riseMax ?? base.riseMax,
    dragX: params.dragX ?? base.dragX,
    width: params.w ?? base.width,
    height: params.h ?? base.height,
  };
}

/**
 * 由 enemy-config 的 du_fu_silhouette 项 + 每实例 params 构建 DufuSilhouetteCfg（数值全来自 config，禁止硬编码）。
 * params 可覆盖：mirrorOffset（反相位差）/ pairId（配对光嘟浮实例 id）/ decoyTriggerDist /
 * ghostPeriodMs / ghostSolidRatio（GDD 16 §3.2）。float/amp/width/height/stompable 沿用原嘟浮。
 */
function buildSilhouetteCfg(raw: EnemyConfigEntry, params?: Record<string, number>): DufuSilhouetteCfg {
  const r = raw as unknown as Partial<DufuSilhouetteCfg>;
  const base: DufuSilhouetteCfg = {
    float: r.float ?? DEFAULT_DU_FU_SILHOUETTE_CFG.float,
    amp: r.amp ?? DEFAULT_DU_FU_SILHOUETTE_CFG.amp,
    width: r.width ?? DEFAULT_DU_FU_SILHOUETTE_CFG.width,
    height: r.height ?? DEFAULT_DU_FU_SILHOUETTE_CFG.height,
    stompable: r.stompable ?? DEFAULT_DU_FU_SILHOUETTE_CFG.stompable,
    twist: r.twist ?? DEFAULT_DU_FU_SILHOUETTE_CFG.twist,
    mirrorOffset: r.mirrorOffset ?? DEFAULT_DU_FU_SILHOUETTE_CFG.mirrorOffset,
    decoyTriggerDist: r.decoyTriggerDist ?? DEFAULT_DU_FU_SILHOUETTE_CFG.decoyTriggerDist,
    ghostPeriodMs: r.ghostPeriodMs ?? DEFAULT_DU_FU_SILHOUETTE_CFG.ghostPeriodMs,
    ghostSolidRatio: r.ghostSolidRatio ?? DEFAULT_DU_FU_SILHOUETTE_CFG.ghostSolidRatio,
    baseYAnchor: r.baseYAnchor ?? DEFAULT_DU_FU_SILHOUETTE_CFG.baseYAnchor,
  };
  if (!params) return base;
  return {
    ...base,
    mirrorOffset: params.mirrorOffset ?? base.mirrorOffset,
    decoyTriggerDist: params.decoyTriggerDist ?? base.decoyTriggerDist,
    ghostPeriodMs: params.ghostPeriodMs ?? base.ghostPeriodMs,
    ghostSolidRatio: params.ghostSolidRatio ?? base.ghostSolidRatio,
  };
}

/**
 * 由关卡实体列表生成真实敌人（替代 C3 占位刺栗）。
 * 识别 ci_li / du_fu / chong_feng / shi_pao / gu_bao / bouncy_vine / cyclone 七类；
 * coin / checkpoint / 未来实体留待各自管线。gu_bao 透传 params（phaseOffset 等）；
 * bouncy_vine 透传 params.power、cyclone 透传 params.w/h/liftAcc/riseMax/dragX。零 Phaser / 零平台 API。
 */
export function createEnemies(
  entities: ReadonlyArray<{ type: string; x: number; y: number; params?: Record<string, number> }>,
): EnemyAI[] {
  const out: EnemyAI[] = [];
  let id = 0;
  for (const e of entities) {
    if (
      e.type === 'ci_li' ||
      e.type === 'du_fu' ||
      e.type === 'chong_feng' ||
      e.type === 'shi_pao' ||
      e.type === 'gu_bao' ||
      e.type === 'bouncy_vine' ||
      e.type === 'cyclone' ||
      e.type === 'du_fu_silhouette' ||
      e.type === 'jellyfish'
    ) {
      out.push(new EnemyAI(e.type as EnemyTypeName, e.x, e.y, id++, enemyConfig, e.params));
    }
  }
  return out;
}
