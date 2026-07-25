/**
 * game/scenes/title-scene — 标题屏（栗宝大冒险 启动首屏）。
 *
 * 启动链：BootScene → TitleScene → GameScene（点击开始 / Enter / Space 进入 1-1）。
 *
 * 纯 Phaser Graphics + 系统字体绘制，零新增位图/音频/字体资源（ADR-004）。
 * 坐标全部相对逻辑中心（512×288），不依赖 window/document，Web + 微信双端兼容。
 *
 * L2「角色登场」（美术规格方向二）落地：
 *   - 圆角暖黄描边标题衬板（几何描边，非 Text 描边）；
 *   - 标题/副标题零 stroke，靠暗色衬板保证对比度；
 *   - 栗宝纯 Graphics 立绘（呼吸 + 眨眼），立于右前景山丘；
 *   - 左侧草丛 + 命粉小花；6–8 颗原创菱形星点缓慢上浮；
 *   - 云朵横向漂移、标题弹入、按钮脉冲 + 悬停放大。
 *
 * 颜色纪律（红线）：仅 grass biome 锁色板 + 栗宝身份色（art-bible §4.2），零新增色值。
 *   - 云朵白 #FFFFFF 仅作标题屏菜单背景插画，不计入游戏内资产调色板（铁律允许）。
 *   - 背景天空 #5BC8F5 由 main.ts 的 backgroundColor 提供，本场景不再重绘。
 */
import Phaser from 'phaser';
import type { Platform } from '../../platform/platform';

const LOGICAL_W = 512;
const LOGICAL_H = 288;
const CENTER_X = LOGICAL_W / 2; // 256

// ── 锁色板（grass biome，0 新增色）──
const COLOR_GRASS_GREEN = 0x7cc242; // 草绿（中景山丘 / 草丛前层）
const COLOR_SHADOW_GREEN = 0x5fa82f; // 阴影绿（远/近景山丘 / 草丛后层）
const COLOR_OUTLINE = 0x2a1a12; // 描边 / 标题衬板填充 / 按钮描边
const COLOR_WARM_ORANGE = 0xf2933c; // 暖橙（开始按钮填充）
const COLOR_WARM_YELLOW = 0xffd23f; // 暖黄（衬板描边 / 栗宝嫩芽·高光 / 花心 / 星点）
const COLOR_LIFE_PINK = 0xf26d8b; // 命粉（小花花瓣 / 栗宝腮红）
const COLOR_CHESTNUT = 0xb5763e; // 栗宝主体（art-bible §4.2 身份色，非本屏新增）
const COLOR_BELLY = 0xf0d9b5; // 栗宝浅色肚皮（同上）
const COLOR_CREAM = '#F4EFE6'; // 石灰白（标题/副标题/按钮/水印文字）
const COLOR_CREAM_NUM = 0xf4efe6; // 同色数值型，供 Graphics 高光/星点使用
const COLOR_CLOUD_WHITE = 0xffffff; // 云朵白：仅为菜单背景插画，不进游戏资产调色板

// 文本字体：微信真机必须显式给中文字体回退，否则 'sans-serif' 大字可能无法渲染。
const TEXT_FONT = "'PingFang SC', 'Microsoft YaHei', 'Heiti SC', 'Noto Sans SC', sans-serif";

// 构建版本水印（用于真机/预览排障，小字保证 CANVAS 可渲染）
const BUILD_LABEL = 'v0.10.0-250725-2140';

// 开始按钮尺寸（热区 ≥ 触屏 32px 高）
const BTN_W = 150;
const BTN_H = 44;

// 标题衬板（圆角矩形，中心 (256,84)，340×76 → x:86–426 / y:46–122）
const PANEL_W = 340;
const PANEL_H = 76;
const PANEL_CX = 256;
const PANEL_CY = 84;

// 山丘 baseY（L2：远/中/近 = 200 / 222 / 244）
const HILL_FAR = 200;
const HILL_MID = 222;
const HILL_NEAR = 244;

// 栗宝立绘锚点（L2：中心 (404,192)，尺寸 ~34×42，立于近景山丘右隆起）
const MALI_CX = 404;
const MALI_CY = 192;

/**
 * 画一朵云（重叠白色椭圆，menu 背景插画）。
 * 仅用 #FFFFFF，不计入资产调色板。
 */
function drawCloud(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number): void {
  g.fillStyle(COLOR_CLOUD_WHITE, 1);
  g.fillEllipse(cx - 14 * s, cy, 30 * s, 18 * s);
  g.fillEllipse(cx, cy - 6 * s, 36 * s, 26 * s);
  g.fillEllipse(cx + 16 * s, cy, 28 * s, 18 * s);
  g.fillEllipse(cx, cy + 5 * s, 44 * s, 20 * s);
}

/**
 * 画一层起伏山丘：底部实填 + 顶部一排椭圆隆起点形成连续曲线。
 * 颜色取自 grass biome 锁色板（草绿 / 阴影绿）。
 */
function drawHillLayer(
  g: Phaser.GameObjects.Graphics,
  baseY: number,
  color: number,
  bumpW: number,
  amp: number,
  count: number,
): void {
  g.fillStyle(color, 1);
  // 底部填色到屏幕底
  g.fillRect(0, baseY, LOGICAL_W, LOGICAL_H - baseY);
  // 顶部隆起的山包（椭圆中心压在 baseY，露出上半部）
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * LOGICAL_W;
    g.fillEllipse(x, baseY, bumpW, amp * 2);
  }
}

/**
 * 画栗宝（纯 Graphics，局部坐标以 (0,0) 为中心，~34×42）。
 * 栗色主体 + 浅色肚皮 + 暖黄嫩芽(头顶) + 暖黄高光 + 描边轮廓 +
 * 命粉腮红 + 圆脸大眼（眼在独立子容器以便眨眼）+ 短圆手脚（art-bible §4.2）。
 */
function drawMali(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(2, COLOR_OUTLINE, 1);
  // 主体栗色
  g.fillStyle(COLOR_CHESTNUT, 1);
  g.fillEllipse(0, 0, 28, 36);
  g.strokeEllipse(0, 0, 28, 36);
  // 浅色肚皮
  g.fillStyle(COLOR_BELLY, 1);
  g.fillEllipse(0, 6, 14, 17);
  // 暖黄高光（左上小片，半透明）
  g.fillStyle(COLOR_WARM_YELLOW, 0.5);
  g.fillEllipse(-6, -7, 4, 7);
  // 短圆手（两侧）
  g.fillStyle(COLOR_CHESTNUT, 1);
  g.fillCircle(-13, 8, 3.5);
  g.strokeCircle(-13, 8, 3.5);
  g.fillCircle(13, 8, 3.5);
  g.strokeCircle(13, 8, 3.5);
  // 短圆脚（底部）
  g.fillCircle(-7, 17, 4.5);
  g.strokeCircle(-7, 17, 4.5);
  g.fillCircle(7, 17, 4.5);
  g.strokeCircle(7, 17, 4.5);
  // 命粉腮红
  g.fillStyle(COLOR_LIFE_PINK, 1);
  g.fillCircle(-8, 3, 2.5);
  g.fillCircle(8, 3, 2.5);
  // 头顶嫩芽（暖黄，两片小叶 + 描边）
  g.fillStyle(COLOR_WARM_YELLOW, 1);
  g.fillEllipse(-3, -18, 5, 10);
  g.strokeEllipse(-3, -18, 5, 10);
  g.fillEllipse(3, -18, 5, 10);
  g.strokeEllipse(3, -18, 5, 10);
}

export class TitleScene extends Phaser.Scene {
  /** 防止键盘 + 点击重复触发 start（双端多次手势）。 */
  private started = false;
  /** 防止 scene restart / 重复 start 导致 UI 重复创建（真机偶发）。 */
  private built = false;

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

    // 固定逻辑坐标（微信端 Scale.NONE 时 this.scale.height 是真实屏幕高度，不是 288）。

    // 云朵（menu 背景插画，白色，不进资产调色板；各自独立横向漂移）
    const cloudDefs = [
      { x: 90, y: 40, s: 1.0 },
      { x: 392, y: 32, s: 1.2 },
      { x: 250, y: 58, s: 0.8 },
    ];
    cloudDefs.forEach((c, i) => {
      const g = this.add.graphics().setDepth(1);
      drawCloud(g, c.x, c.y, c.s);
      this.tweens.add({
        targets: g,
        x: '+=10',
        duration: 4500,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
        delay: i * 600,
      });
    });

    // 山丘（3 层起伏，锁色板草绿/阴影绿，营造景深）
    const hills = this.add.graphics().setDepth(2);
    drawHillLayer(hills, HILL_FAR, COLOR_SHADOW_GREEN, 130, 22, 5);
    drawHillLayer(hills, HILL_MID, COLOR_GRASS_GREEN, 150, 26, 4);
    drawHillLayer(hills, HILL_NEAR, COLOR_SHADOW_GREEN, 170, 30, 4);

    // 左侧草丛 + 暖黄小花（中心 (104,200)）：草绿/阴影绿草丛 + 命粉花瓣 + 暖黄花心
    const grass = this.add.graphics().setDepth(5);
    // 后层（阴影绿）
    grass.fillStyle(COLOR_SHADOW_GREEN, 1);
    grass.fillTriangle(92, 202, 98, 202, 95, 182);
    grass.fillTriangle(102, 202, 108, 202, 105, 178);
    grass.fillTriangle(110, 202, 116, 202, 113, 184);
    // 前层（草绿）
    grass.fillStyle(COLOR_GRASS_GREEN, 1);
    grass.fillTriangle(96, 202, 101, 202, 98.5, 188);
    grass.fillTriangle(103, 202, 108, 202, 105.5, 186);
    // 花茎（草绿细）
    grass.fillStyle(COLOR_GRASS_GREEN, 1);
    grass.fillRect(103.5, 166, 1, 18);
    // 花瓣（命粉）
    grass.fillStyle(COLOR_LIFE_PINK, 1);
    grass.fillCircle(104, 160, 3);
    grass.fillCircle(104, 172, 3);
    grass.fillCircle(98, 166, 3);
    grass.fillCircle(110, 166, 3);
    // 花心（暖黄）
    grass.fillStyle(COLOR_WARM_YELLOW, 1);
    grass.fillCircle(104, 166, 3);

    // 栗宝立绘（纯 Graphics 容器：便于整体呼吸缩放，眼睛独立子容器便于眨眼）
    const mali = this.add.container(MALI_CX, MALI_CY).setDepth(6);
    const maliBody = this.add.graphics();
    drawMali(maliBody);
    mali.add(maliBody);
    // 眼睛子容器（位于面部中心，眨眼用 scaleY 压扁，非精灵帧）
    const eyeGroup = this.add.container(0, -4);
    const eyes = this.add.graphics();
    eyes.fillStyle(COLOR_OUTLINE, 1);
    eyes.fillCircle(-6, 0, 3.5);
    eyes.fillCircle(6, 0, 3.5);
    eyes.fillStyle(COLOR_CREAM_NUM, 1);
    eyes.fillCircle(-7, -1, 1.2);
    eyes.fillCircle(5, -1, 1.2);
    eyeGroup.add(eyes);
    mali.add(eyeGroup);

    // 星点粒子（6–8 颗原创菱形，严禁★符号；缓慢上浮 + alpha 渐隐，错相位）
    const starDefs = [
      { x: 140, y: 42, c: COLOR_CREAM_NUM, r: 2.4 },
      { x: 175, y: 58, c: COLOR_WARM_YELLOW, r: 2.0 },
      { x: 210, y: 36, c: COLOR_CREAM_NUM, r: 2.6 },
      { x: 250, y: 64, c: COLOR_WARM_YELLOW, r: 2.2 },
      { x: 285, y: 48, c: COLOR_CREAM_NUM, r: 2.0 },
      { x: 325, y: 34, c: COLOR_WARM_YELLOW, r: 2.6 },
      { x: 365, y: 56, c: COLOR_CREAM_NUM, r: 2.2 },
    ];
    starDefs.forEach((s, i) => {
      const g = this.add.graphics().setDepth(8);
      g.fillStyle(s.c, 1);
      g.fillPoints(
        [
          { x: s.x, y: s.y - s.r },
          { x: s.x + s.r, y: s.y },
          { x: s.x, y: s.y + s.r },
          { x: s.x - s.r, y: s.y },
        ],
        true,
      );
      g.setAlpha(0.2);
      this.tweens.add({
        targets: g,
        y: g.y - 18,
        duration: 2400,
        repeat: -1,
        delay: i * 340,
        keyframes: [
          { alpha: 0.9, duration: 1100, ease: 'Sine.Out' },
          { alpha: 0, duration: 1300, ease: 'Sine.In' },
        ],
      });
    });

    // 标题区衬板：圆角矩形 + 暖黄几何细描边（几何描边安全，非 Text 描边）
    const panelG = this.add.graphics().setDepth(9);
    panelG.fillStyle(COLOR_OUTLINE, 0.5);
    panelG.fillRoundedRect(PANEL_CX - PANEL_W / 2, PANEL_CY - PANEL_H / 2, PANEL_W, PANEL_H, 12);
    panelG.lineStyle(2, COLOR_WARM_YELLOW, 1);
    panelG.strokeRoundedRect(PANEL_CX - PANEL_W / 2, PANEL_CY - PANEL_H / 2, PANEL_W, PANEL_H, 12);

    // 大标题「栗宝大冒险」：居中偏上，32px 无描边，依赖暗色衬板提供对比度
    const title = this.add
      .text(CENTER_X, 74, '栗宝大冒险', {
        fontFamily: TEXT_FONT,
        fontSize: '32px',
        color: COLOR_CREAM,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // 副标题「像素风横版跳跃冒险」：标题下方，小一号，无描边
    const subtitle = this.add
      .text(CENTER_X, 104, '像素风横版跳跃冒险', {
        fontFamily: TEXT_FONT,
        fontSize: '14px',
        color: COLOR_CREAM,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // 标题入场弹入（scale 0.9→1，Back.easeOut 460ms，alpha 0.6→1）
    title.setScale(0.9).setAlpha(0.6);
    this.tweens.add({
      targets: title,
      scale: 1,
      alpha: 1,
      duration: 460,
      ease: 'Back.easeOut',
    });
    subtitle.setScale(0.9).setAlpha(0.6);
    this.tweens.add({
      targets: subtitle,
      scale: 1,
      alpha: 1,
      duration: 460,
      ease: 'Back.easeOut',
      delay: 80,
    });
    // 副标题轻微浮动（相位错开，避免与弹入冲突）
    this.tweens.add({
      targets: subtitle,
      y: 101,
      duration: 1600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      delay: 600,
    });

    // 栗宝呼吸（scaleY 1→1.04，1400ms Sine.InOut yoyo repeat -1）
    this.tweens.add({
      targets: mali,
      scaleY: 1.04,
      duration: 1400,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    // 栗宝眨眼（双眼 scaleY 压扁闪 120ms，每 ~3.2s 一次）
    this.tweens.add({
      targets: eyeGroup,
      scaleY: 0.12,
      duration: 120,
      yoyo: true,
      repeat: -1,
      repeatDelay: 3080,
      delay: 3200,
    });

    // 开始按钮「▶ 开始游戏」：底部居中，暖橙填充 + 几何描边 + 石灰白文字
    const btnY = 220;
    const btn = this.add.container(CENTER_X, btnY).setDepth(20);
    const btnRect = this.add
      .rectangle(0, 0, BTN_W, BTN_H, COLOR_WARM_ORANGE, 1)
      .setStrokeStyle(2, COLOR_OUTLINE, 1);
    const btnText = this.add
      .text(0, 0, '▶ 开始游戏', {
        fontFamily: TEXT_FONT,
        fontSize: '18px',
        color: COLOR_CREAM,
      })
      .setOrigin(0.5);
    btn.add([btnRect, btnText]);
    btn.setSize(BTN_W, BTN_H);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.startGame());
    // 按钮脉冲（scale 1→1.06，700ms）+ 悬停放大 1.08
    const pulse = this.tweens.add({
      targets: btn,
      scale: 1.06,
      duration: 700,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    btn.on('pointerover', () => {
      pulse.pause();
      btn.setScale(1.08);
    });
    btn.on('pointerout', () => {
      btn.setScale(1);
      pulse.restart();
    });

    // 版本水印（右下角，小字，便于真机/预览确认是否用了最新包）
    this.add
      .text(LOGICAL_W - 6, LOGICAL_H - 6, BUILD_LABEL, {
        fontFamily: TEXT_FONT,
        fontSize: '10px',
        color: COLOR_CREAM,
      })
      .setOrigin(1, 1)
      .setDepth(100);

    // ── 键盘 Enter / Space 开始 ──
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

    // ── S05-4-BGM：首次用户交互后播 menu BGM ──
    // 解锁（main.ts 首次手势后才 resume）前 playMusic 会 no-op（契约允许）；故注册一次性
    // pointerdown/keydown 监听，首次真实交互后再播。进入 startGame 会改播 stage（覆盖）。
    const platform = this.resolvePlatform();
    if (platform) {
      const onFirstInteract = () => {
        if (this.started) return; // 已进入游戏则不回退播 menu
        platform.audio.playMusic('music:menu');
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

  /** 进入 GameScene（关卡 1-1，GameScene 默认加载首关）。防重复触发。 */
  private startGame(): void {
    if (this.started) return;
    this.started = true;
    // S05-4-BGM：进关改播 stage（AudioPort 换名先停 menu 后起 stage，无双循环叠加）。
    this.resolvePlatform()?.audio.playMusic('music:stage');
    this.scene.start('Game');
  }
}
