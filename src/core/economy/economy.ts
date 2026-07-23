/**
 * core/economy/economy — 经济 / 分数（GDD 06，E1.S3 骨架）。
 * ON_STOMP+100 / ON_COIN+10 / goal+500 / 连击倍率 / lives。零 Phaser。
 */
import { economyConfig } from '../config';

export interface EconomyState {
  coins: number;
  score: number;
  lives: number;
  combo: number;
  comboTimer: number;
  form: string;
}

export class Economy {
  state: EconomyState;

  constructor() {
    this.state = {
      coins: 0,
      score: 0,
      lives: economyConfig.initialLives,
      combo: 0,
      comboTimer: 0,
      form: 'BASE',
    };
  }

  /** E4.S2：计分 / 连击倍率 / lives 递减。当前占位。 */
  addScore(_amount: number): void {
    // TODO(E4.S2): 连击窗 comboWindowMs / 封顶 maxMult / lives--。
  }
}
