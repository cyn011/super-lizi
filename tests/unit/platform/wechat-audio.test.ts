/**
 * tests/unit/platform/wechat-audio.test.ts — S05-4 微信端流式音频（audio-design.md §3.2）。
 *
 * 纯 Node（零 Phaser / 零 wx）。验证已知限制下的健壮性：
 *   1) 未 unlock → play 静默不崩；
 *   2) unlock 但 SFX_CDN 无 URL → play 静默不崩（素材未到位，known limitation）；
 *   3) 非微信环境（globalThis.wx 未定义）→ play 静默不崩；
 *   4) 注入 fake wx + CDN URL → 走 wx.createInnerAudioContext().src=.play() 且每次新建受限；
 *   5) SFX_CDN 初始为空（不引入真实 CDN URL，D9 待主理人提供）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WechatAudio, SFX_CDN } from '../../../src/platform/wechat/wechat-audio';

describe('WechatAudio · 静默不崩（S05-4 known limitation）', () => {
  afterEach(() => {
    // 清理可能注入的 fake wx，避免污染后续用例。
    delete (globalThis as unknown as { wx?: unknown }).wx;
  });

  it('SFX_CDN 初始为空（不引入真实 CDN URL）', () => {
    expect(SFX_CDN).toEqual({});
  });

  it('未 unlock 时 play 静默不崩', () => {
    const a = new WechatAudio();
    expect(() => a.play('sfx:jump')).not.toThrow();
  });

  it('unlock 但无 URL 时 play 静默不崩', () => {
    const a = new WechatAudio();
    a.unlock();
    expect(() => a.play('sfx:jump')).not.toThrow();
  });

  it('非微信环境（wx 未定义）play 静默不崩', () => {
    const a = new WechatAudio();
    a.unlock();
    expect(() => a.play('sfx:coin')).not.toThrow();
  });

  it('注入 fake wx + CDN URL → 走 createInnerAudioContext 且设置 src/play', () => {
    const created: Array<{ src: string; played: boolean }> = [];
    const fakeWx = {
      createInnerAudioContext() {
        const ctx = { src: '', played: false, play() { this.played = true; } };
        created.push(ctx);
        return ctx;
      },
    };
    (globalThis as unknown as { wx?: unknown }).wx = fakeWx;

    SFX_CDN['sfx:jump'] = 'https://cdn.example.com/sfx/jump.mp3';
    const a = new WechatAudio();
    a.unlock();
    expect(() => a.play('sfx:jump')).not.toThrow();

    expect(created.length).toBe(1);
    expect(created[0].src).toBe('https://cdn.example.com/sfx/jump.mp3');
    expect(created[0].played).toBe(true);

    // 清理：避免影响其他用例与全局状态
    delete SFX_CDN['sfx:jump'];
  });

  it('unlock 但 URL 缺失时即便 wx 存在也不调用 createInnerAudioContext', () => {
    let createCalls = 0;
    const fakeWx = {
      createInnerAudioContext() {
        createCalls++;
        return { src: '', play() {} };
      },
    };
    (globalThis as unknown as { wx?: unknown }).wx = fakeWx;

    const a = new WechatAudio();
    a.unlock();
    a.play('sfx:unknown_no_url'); // SFX_CDN 中无此 key
    expect(createCalls).toBe(0);
  });
});
