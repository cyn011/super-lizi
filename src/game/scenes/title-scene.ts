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
  /** 音频是否已解锁（首触解锁后=true；从游戏返回且仍在 running 时初始化为 true）。 */
  private audioArmed = false;
  /** 首触解锁阶段锁定的进入关卡（有进度=续关，否则 1-1）。 */
  private pendingLevel = '1-1';
  /** 解锁提示（首触后出现，提示玩家再点一次进入）。 */
  private startPrompt?: Phaser.GameObjects.Text;

  constructor() {
    super('Title');
  }

  create(): void {
    // 场景重启（从游戏返回标题等）会清空显示列表与输入监听，交互 UI 必须重建；
    // 但诊断红屏 / 备用背景等一次性初始化只在首次进行，避免叠加。
    const firstTime = !this.built;
    this.built = true;
    this.started = false;
    this.startPrompt = undefined;
    this.bgAdded = false;

    // 固定逻辑坐标（微信端 Scale.NONE 时 this.scale.height 是真实屏幕高度，不是 288）。
    this.platform = this.resolvePlatform();
    this.reduceMotion = this.platform?.reduceMotion ?? false;

    if (firstTime) {
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

      // 背景图异步加载（不阻塞进游戏；失败也有点击区可用）。
      try {
        this.loadBackground();
      } catch (e) {
        this.logDebug('loadBackground failed', e);
      }
    }

    this.recomputeEntryState();

    // 核心 UI 立即创建（不依赖背景图是否加载成功）。每次 create 重建，保证返程可点。
    // 用 try/catch 包裹，任何 UI 创建错误都不阻塞进游戏。
    try {
      this.createInteractiveUI();
    } catch (e) {
      this.logDebug('createInteractiveUI failed', e);
    }
  }

  /** 依据存档进度重算待进关卡，并按音频是否已在 running 决定是否需要两步解锁。 */
  private recomputeEntryState(): void {
    this.pendingLevel = this.computePendingLevel();
    // 音频已在 running（如从游戏内返回标题）→ 首触即进，无需两步唤醒。
    this.audioArmed = this.platform?.audio.isRunning() ?? false;
  }

  /** 取续关关卡：有进度（>1 关）取最靠后，否则 1-1。 */
  private computePendingLevel(): string {
    try {
      const save = this.platform?.storage ? new SaveManager(this.platform.storage).load() : undefined;
      const unlocked = save?.unlockedLevels ?? ['1-1'];
      if (unlocked.length > 1) return lastUnlockedLevelId(unlocked);
    } catch {
      /* 存档读取失败 → 回退 1-1 */
    }
    return '1-1';
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
    const hasProgress = this.pendingLevel !== '1-1';
    const continueId = this.pendingLevel;

    // ═════════════════════════════════════════════════════
    //  CONTINUE LINE（纯视觉提示，不拦截点击；进度 >1 关时显示）
    // ═════════════════════════════════════════════════════
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
      subline.setAlpha(0);
      if (!this.reduceMotion) {
        this.tweens.add({ targets: subline, alpha: 0.85, duration: 300, delay: 400 });
      } else {
        subline.setAlpha(0.85);
      }
    } else {
      subline.setVisible(false);
    }

    // ═════════════════════════════════════════════════════
    //  全屏透明热区：点击整页任意位置进入游戏
    //  （修「只点按钮才进 / 要点很多次」——旧实现是 START_BTN_W×H 的小块）
    // ═════════════════════════════════════════════════════
    const enterZone = this.add
      .rectangle(CENTER_X, LOGICAL_H / 2, LOGICAL_W, LOGICAL_H, 0xffffff, 0)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    let pressed = false;
    enterZone.on('pointerdown', () => {
      pressed = true;
    });
    enterZone.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      this.handleTitleTap();
    });
    enterZone.on('pointerout', () => {
      pressed = false;
    });

    // ═════════════════════════════════════════════════════
    //  KEYBOARD — Enter / Space 进入（同两步逻辑）
    // ═════════════════════════════════════════════════════
    this.input.keyboard?.on('keydown-ENTER', () => this.handleTitleTap());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleTitleTap());
  }

  /**
   * 标题页点击统一入口（两步解锁）：
   *  - 未解锁：首触解锁音频 + 播 menu BGM 并停留在标题页（让玩家听到首页音乐），
   *    同时弹出「点击任意位置开始」提示；再次点击任意位置才进游戏。
   *  - 已解锁（音频已 running，如从游戏返回）：首触直接进游戏。
   * 微信自动播放策略下，AudioContext 必须在用户手势内创建/resume，故首页有声需先有一步唤醒。
   */
  private handleTitleTap(): void {
    if (this.started) return;
    if (!this.audioArmed) {
      this.platform?.audio.unlock();
      this.platform?.audio.playMusic('music:menu');
      this.audioArmed = true;
      this.showStartPrompt();
      return;
    }
    this.startGame(this.pendingLevel);
  }

  /** 首触解锁后出现的提示，引导玩家再次点击进入。 */
  private showStartPrompt(): void {
    if (this.startPrompt) return;
    this.startPrompt = this.add
      .text(CENTER_X, LOGICAL_H - 26, '▶ 点击任意位置开始游戏', {
        fontFamily: TEXT_FONT,
        fontSize: '12px',
        color: COLOR_CREAM,
        stroke: OUTLINE_STR,
        strokeThickness: 1,
      })
      .setOrigin(0.5)
      .setDepth(12);
    if (!this.reduceMotion) {
      this.tweens.add({
        targets: this.startPrompt,
        alpha: { from: 0.45, to: 1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
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
