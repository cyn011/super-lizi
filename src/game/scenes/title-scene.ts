/**
 * game/scenes/title-scene — 标题屏（栗宝大冒险 启动首屏，游戏封面）v6
 *
 * 启动链：BootScene → TitleScene → GameScene（点击开始 / Enter / Space 进 1-1；副行进续关）。
 *
 * v6 修复（微信蓝屏）：
 *   Phaser Loader 对图片走 XHR，微信小游戏 XHR 无法加载包内本地图 → 纹理缺失 → 蓝屏。
 *   v5 尝试 base64 内联 + 临时文件，仍因微信端路径/加载策略不稳而失败。
 *   v6 策略：
 *     - Web 端：继续使用 base64 data URL（零额外文件请求）。
 *     - 微信端：构建时把 assets/title-bg.png 复制到 dist-wechat/title-bg.png，
 *             运行时直接用 `new Image().src = 'title-bg.png'` 加载包内图
 *             （game.js 的 Image polyfill 内部会走 wx.createImage，支持包内路径）。
 *   同时加入备用背景色与错误兜底，即使图片加载失败也不会只剩默认蓝屏。
 *
 * 首页背景图：标题/按钮/Mali/装饰均已包含在图中；
 * 本文件只负责背景图展示 + 虚拟点击区 + 继续行 + 键盘/BGM 交互。
 * 坐标全部相对逻辑中心（512×288），Web + 微信双端兼容。
 */
import Phaser from 'phaser';
import type { Platform } from '../../platform/platform';
import { SaveManager } from '../../core/meta/save-data';

// ── 逻辑画布尺寸 ──
const LOGICAL_W = 512;
const LOGICAL_H = 288;
const CENTER_X = LOGICAL_W / 2; // 256

// 背景图路径：Web 端经 Vite 放 dist/title-bg.png，微信端经 copy-wechat 放包根。
// 两端统一用包内相对文件名，避免 base64 内联（减小 bundle、加快首屏）。
const TITLE_BG_KEY = 'title-bg';
const TITLE_BG_PATH = 'title-bg.png';

// 文本字体：微信真机必须显式给中文字体回退
const TEXT_FONT = "'PingFang SC', 'Microsoft YaHei', 'Heiti SC', 'Noto Sans SC', sans-serif";

// 文本描边（字符串型，Phaser Text stroke 参数用）
const OUTLINE_STR = '#2A1A12';
const COLOR_CREAM = '#F4EFE6';

// 虚拟「开始冒险」按钮点击区（与背景图中按钮位置对齐）
const START_BTN_CX = 256;
const START_BTN_CY = 200;
const START_BTN_W = 150;
const START_BTN_H = 50;

// 继续行位置（按钮下方，与按钮阴影保持间距避免重叠）
const CONTINUE_CY = 268;

/** 关卡 id 排序键（"c-l" → 数值，跨章可比）。 */
function levelSortKey(id: string): number {
  const m = /^(\d+)-(\d+)$/.exec(id);
  if (!m) return 0;
  return Number(m[1]) * 1000 + Number(m[2]);
}

/** 取最大（最靠后）已解锁关卡 id；空则回退 1-1。 */
function lastUnlockedLevelId(ids: string[]): string {
  if (ids.length === 0) return '1-1';
  return [...ids].sort((a, b) => levelSortKey(a) - levelSortKey(b)).pop() as string;
}

export class TitleScene extends Phaser.Scene {
  /** 防止键盘 + 点击重复触发 start（双端多次手势）。 */
  private started = false;
  /** 防止 scene restart / 重复 start 导致 UI 重复创建（真机偶发）。 */
  private built = false;
  /** 全局平台（含 reduceMotion / storage / audio）。 */
  private platform?: Platform;
  /** 减少动态（accessibility）：开启时冻结全部循环动效，显示静态合成帧。 */
  private reduceMotion = false;
  /** 背景图是否已添加（防重复创建）。 */
  private bgAdded = false;
  /** 诊断红屏（蓝屏排查用，背景图加载成功后移除）。含红块 + 文字。 */
  private diagObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    // 幂等：若已构建过（scene restart 等），仅重置触发锁，避免叠加创建 UI。
    if (this.built) {
      this.started = false;
      return;
    }
    this.built = true;
    this.started = false;
    this.bgAdded = false;

    // 固定逻辑坐标（微信端 Scale.NONE 时 this.scale.height 是真实屏幕高度，不是 288）。
    this.platform = this.resolvePlatform();
    this.reduceMotion = this.platform?.reduceMotion ?? false;

    // === DIAG（蓝屏排查）：TitleScene 启动即铺全屏红，置于最上层。
    // 背景图加载成功 → 移除红屏，露出真实背景；失败则保留红屏（确认场景已跑但图片未加载）。
    // 若微信端仍纯蓝 → TitleScene.create() 未执行 / 新代码未生效。
    const diagRect = this.add
      .rectangle(CENTER_X, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, 0xff0000)
      .setDepth(10000);
    const diagText = this.add
      .text(CENTER_X, LOGICAL_H / 2, 'DIAG TITLE', {
        fontFamily: TEXT_FONT,
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(10001);
    this.diagObjects = [diagRect, diagText];

    // 先铺一层备用背景：防止图片加载前/失败后只剩 Phaser 默认蓝屏。
    this.addFallbackBackground();

    // 核心 UI 立即创建（不依赖背景图是否加载成功）。
    // 用 try/catch 包裹，任何 UI 创建错误都不阻塞进游戏。
    try {
      this.createInteractiveUI();
    } catch (e) {
      this.logDebug('createInteractiveUI failed', e);
    }

    // 背景图异步加载（不阻塞进游戏；失败也有点击区可用）。
    try {
      this.loadBackground();
    } catch (e) {
      this.logDebug('loadBackground failed', e);
    }
  }

  /** 铺一层与背景图主色调接近的备用背景，避免默认蓝屏。 */
  private addFallbackBackground(): void {
    this.add
      .rectangle(CENTER_X, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, 0x3a7ca5)
      .setDepth(-100);
  }

  /**
   * 加载背景图并注册为 Phaser 纹理。
   * 两端都加载包内 title-bg.png（Vite 放 dist/，copy-wechat 放 dist-wechat/ 根目录），
   * 用原生 Image / wx.createImage 解码，绕开 Phaser Loader 的 XHR（微信端无法 XHR 本地图）。
   */
  private loadBackground(): void {
    const isWechat = this.platform?.env === 'wechat';
    if (isWechat) {
      this.loadBackgroundWechat();
    } else {
      this.loadBackgroundWeb();
    }
  }

  private loadBackgroundWeb(): void {
    const im = new Image();
    im.onload = () => this.addBackgroundImage(im);
    im.onerror = () => this.onBackgroundFailed('web image load failed');
    im.src = TITLE_BG_PATH;
  }

  private loadBackgroundWechat(): void {
    // 优先用 wx.createImage()（微信官方加载包内图的 API，比
    // new Image() 的 polyfill 更可靠，且返回对象可 drawImage 到 canvas）。
    const wx = (globalThis as { wx?: {
      createImage?: () => HTMLImageElement & { onload: unknown; onerror: unknown; src: string };
    } }).wx;
    if (wx && typeof wx.createImage === 'function') {
      const im = wx.createImage();
      im.onload = () => this.addBackgroundImage(im);
      im.onerror = () => this.onBackgroundFailed('wx.createImage load failed');
      im.src = TITLE_BG_PATH;
    } else {
      // 回退：new Image()（game.js polyfill 会桥接到 wx.createImage）。
      const im = new Image();
      im.onload = () => this.addBackgroundImage(im);
      im.onerror = () => this.onBackgroundFailed('wechat new Image load failed');
      im.src = TITLE_BG_PATH;
    }
  }

  private addBackgroundImage(source: HTMLImageElement | HTMLCanvasElement): void {
    if (this.started || this.bgAdded) return;
    try {
      // 微信的 Image polyfill 返回的对象可能不是标准 HTMLImageElement，
      // Phaser textures.addImage 解析会失败/黑屏。统一先画到 canvas，
      // 再用 textures.addCanvas() 注册，双端都稳。
      const width = (source as HTMLImageElement).naturalWidth || (source as HTMLImageElement).width;
      const height = (source as HTMLImageElement).naturalHeight || (source as HTMLImageElement).height;
      this.logDebug('bg source size', { width, height });
      if (!width || !height) {
        this.onBackgroundFailed('bg source has zero size');
        return;
      }

      const tex = this.textures.createCanvas(TITLE_BG_KEY, width, height);
      if (!tex) {
        this.onBackgroundFailed('createCanvas returned null');
        return;
      }
      const ctx = tex.getContext();
      ctx.drawImage(source as unknown as CanvasImageSource, 0, 0);
      tex.refresh();

      this.bgAdded = true;
      this.add
        .image(CENTER_X, LOGICAL_H / 2, TITLE_BG_KEY)
        .setDepth(0)
        .setDisplaySize(LOGICAL_W, LOGICAL_H);
      // 背景图成功 → 移除诊断红屏，露出真实背景。
      this.diagObjects.forEach((o) => o.destroy());
      this.diagObjects = [];
    } catch (e) {
      this.logDebug('addBackgroundImage failed', e);
      this.onBackgroundFailed('addBackgroundImage exception');
    }
  }

  private onBackgroundFailed(_reason: string): void {
    // 静默失败：保留核心点击区，玩家仍可点击进入游戏。
    this.logDebug('background failed', _reason);
  }

  /** 创建虚拟点击区、继续行、键盘事件、BGM 交互。 */
  private createInteractiveUI(): void {
    // ═════════════════════════════════════════════════════
    //  LAYER 1 — 虚拟「开始冒险」点击区（透明，覆盖图中按钮）
    // ═════════════════════════════════════════════════════
    const startHit = this.add
      .rectangle(START_BTN_CX, START_BTN_CY, START_BTN_W, START_BTN_H, 0xffffff, 0)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    let pressed = false;
    startHit.on('pointerdown', () => {
      pressed = true;
      startHit.setScale(0.97);
    });
    startHit.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      startHit.setScale(1);
      this.startGame();
    });
    startHit.on('pointerout', () => {
      pressed = false;
      startHit.setScale(1);
    });

    // ═════════════════════════════════════════════════════
    //  LAYER 2 — CONTINUE LINE（仅存档进度 > 1 关时显示）
    // ═════════════════════════════════════════════════════
    let save;
    try {
      save = this.platform?.storage ? new SaveManager(this.platform.storage).load() : undefined;
    } catch (e) {
      this.logDebug('save load failed', e);
      save = undefined;
    }
    const unlocked = save?.unlockedLevels ?? ['1-1'];
    const hasProgress = unlocked.length > 1; // 多于默认单关 = 存在进度
    const continueId = lastUnlockedLevelId(unlocked);
    const subline = this.add
      .text(CENTER_X, CONTINUE_CY, hasProgress ? `继续第 ${continueId} 关` : '', {
        fontFamily: TEXT_FONT,
        fontSize: '10px',
        color: COLOR_CREAM,
        stroke: OUTLINE_STR,
        strokeThickness: 0.5,
      })
      .setOrigin(0.5)
      .setDepth(11);

    if (hasProgress) {
      subline.setInteractive({ useHandCursor: true });
      subline.on('pointerdown', () => this.startGame(continueId));
      subline.setAlpha(0);
      if (!this.reduceMotion) {
        this.tweens.add({ targets: subline, alpha: 0.85, duration: 300, delay: 300 });
      } else {
        subline.setAlpha(0.85);
      }
    } else {
      subline.setVisible(false);
    }

    // ═════════════════════════════════════════════════════
    //  KEYBOARD — Enter / Space 开始游戏
    // ═════════════════════════════════════════════════════
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

    // ═════════════════════════════════════════════════════
    //  S05-4-BGM：首次用户交互后播 menu BGM
    // ═════════════════════════════════════════════════════
    if (this.platform) {
      const onFirstInteract = () => {
        if (this.started) return; // 已进入游戏则不回退播 menu
        this.platform?.audio.playMusic('music:menu');
      };
      this.input.once('pointerdown', onFirstInteract);
      this.input.keyboard?.once('keydown', onFirstInteract);
    }
  }

  /** 从 registry / globalThis 解析 Platform（main.ts 已注入并兜底）。 */
  private resolvePlatform(): Platform | undefined {
    const fromReg = this.registry.get('platform') as Platform | undefined;
    if (fromReg && fromReg.env) return fromReg;
    return (globalThis as unknown as { __superMaliPlatform?: Platform }).__superMaliPlatform;
  }

  /** 进入 GameScene。默认 1-1；副行传入续关 id。防重复触发。 */
  private startGame(levelId: string = '1-1'): void {
    if (this.started) return;
    this.started = true;
    // S05-4-BGM：进关改播 stage（AudioPort 换名先停 menu 后起 stage，无双循环叠加）。
    this.platform?.audio.playMusic('music:stage');
    this.scene.start('Game', { startLevel: levelId });
  }

  /** 调试日志：微信真机可开 vConsole 查看；生产环境默认静默。 */
  private logDebug(label: string, info?: unknown): void {
    try {
      // eslint-disable-next-line no-console
      console.warn(`[TitleScene] ${label}:`, info);
    } catch (_) {
      // ignore
    }
  }
}
