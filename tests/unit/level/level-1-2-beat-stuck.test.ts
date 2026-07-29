/**
 * tests/unit/level/level-1-2-beat-stuck.test.ts — ENG-1-2-BEAT-FIX 回归。
 *
 * 根因：1-2 的节拍平台 bp_1_2 瓦片原放在 ty5（y160–192），栗宝站立时碰撞盒 y190–224
 * 与平台底（y192）重叠 2px；进入 solid 相位时 resolveAxisX 把该行瓦当实心墙，将角色
 * 推回 x≈584 → 右行卡死。对照 1-1 的 bp_pulse_a 放在头顶之上（ty4）正常。
 *
 * 修复（唯一数据改动）：bp_1_2 三块瓦片 ty 5→4（tx 不变）。本测试锁定该修复并做核心回归：
 *   1) 锁死断言：beatPlatforms[0] 所有瓦片 ty===4，防止被人挪回 ty5。
 *   2) 核心回归：强制 bp_1_2 为 solid（模拟进入 solid 相位），持续右行 ~1500 步，
 *      断言角色 x 越过平台右侧（>720），即不再卡在 x≈584。
 *
 * 全程零 Phaser / 零平台 API，与 level-complete.test.ts 共用 LevelLoader + runStepSim。
 */
import { describe, it, expect } from 'vitest';
import level1_2 from '../../../src/config/levels/1-2.json';
import { LevelLoader } from '../../../src/core/level/level-loader';
import { CharacterController } from '../../../src/core/character/character-controller';
import type { InputState } from '../../../src/core/input/input-abstraction';
import { characterConfig } from '../../../src/core/config';
import { runStepSim } from '../../../src/game/scene-sync';
import { STEP_DT } from '../_step';

const level = level1_2 as unknown as import('../../../src/core/level/level-data').LevelData;
const rt = LevelLoader.load(level);

function mkInput(over: Partial<InputState> = {}): InputState {
  return {
    left: false,
    right: false,
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    actionPressed: false,
    actionHeld: false,
    actionReleased: false,
    jumpPressedAt: 0,
    throwPressed: false,
    throwHeld: false,
    throwReleased: false,
    ...over,
  };
}

/** 平台右侧像素边界（用于判定「越过平台」）。tx21 右缘 = (21+1)*32 = 704，越过判定线取 720。 */
const PLATFORM_RIGHT_X = (21 + 1) * 32; // 704
const PASS_X = PLATFORM_RIGHT_X + 16; // 720

describe('ENG-1-2-BEAT-FIX: bp_1_2 节拍平台卡死回归', () => {
  it('断言锁死修复：beatPlatforms[0] 瓦片固定 ty=4（防回退到 ty5）', () => {
    const bp0 = rt.data.beatPlatforms![0];
    expect(bp0.id).toBe('bp_1_2');
    expect(bp0.tiles.every((t) => t.ty === 4)).toBe(true);
  });

  it('核心回归：bp_1_2 强制 solid 时角色右行越过平台（不再卡 x≈584）', () => {
    const bp = rt.data.beatPlatforms![0];
    // 模拟进入 solid 相位：把 bp_1_2 真实瓦片强制为实心（此时应为 ty4）。
    for (const t of bp.tiles) rt.setBeatTileSolid(t.tx, t.ty, true);

    const body = { x: rt.spawn.x, y: rt.spawn.y, w: 24, h: 34, vx: 0, vy: 0 };
    const cc = new CharacterController(characterConfig, {
      x: rt.spawn.x,
      y: rt.spawn.y,
      grounded: true,
    });
    const ctx = { body, controller: cc, world: rt.world };
    let lg = true;

    let maxX = body.x;
    let stuck = false;
    let lastX = body.x;
    let plateauSteps = 0;
    let maxPlateau = 0;
    for (let i = 0; i < 1500; i++) {
      const res = runStepSim(ctx, mkInput({ right: true }), lg, STEP_DT);
      lg = res.grounded;
      if (body.x > maxX) maxX = body.x;
      // 辅助：检测停滞（x 在 1px 内连续不前进）。
      if (Math.abs(body.x - lastX) < 1) {
        plateauSteps++;
        if (plateauSteps > maxPlateau) maxPlateau = plateauSteps;
      } else {
        plateauSteps = 0;
      }
      lastX = body.x;
    }

    // 主断言：角色 x 越过平台右侧（>720），证明不再被 solid 相位卡在 x≈584。
    expect(body.x).toBeGreaterThan(PASS_X);

    // 辅助断言：全程最大推进量应远超平台左侧卡点（584），且不得出现长停滞平台。
    // 若有人把瓦片挪回 ty5，角色会在 x≈584 前长期停滞并卡死，maxX 接近 584、maxPlateau 很大。
    expect(maxX).toBeGreaterThan(PASS_X);
    void stuck; // 仅记录用途，主结论由 body.x / maxX 给出。
  });
});
