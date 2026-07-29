#!/usr/bin/env python3
"""处理用户提供的 UI 按钮 PNG：裁剪透明边、居中、缩放到 128×128 像素风、压缩。"""
from PIL import Image
import sys
from pathlib import Path

TARGET_SIZE = 128


def process(src: Path, dst: Path):
    im = Image.open(src).convert('RGBA')
    # 裁剪到非透明内容边界
    alpha = im.getchannel('A')
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError(f'{src} 是完全透明图片')
    cropped = im.crop(bbox)

    # 保持宽高比缩放到目标正方形内，使用最近邻保留像素风
    cw, ch = cropped.size
    scale = min(TARGET_SIZE / cw, TARGET_SIZE / ch)
    new_w = max(1, int(cw * scale))
    new_h = max(1, int(ch * scale))
    scaled = cropped.resize((new_w, new_h), Image.Resampling.NEAREST)

    # 居中到 128×128 透明画布
    out = Image.new('RGBA', (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
    x = (TARGET_SIZE - new_w) // 2
    y = (TARGET_SIZE - new_h) // 2
    out.paste(scaled, (x, y), scaled)
    out.save(dst, 'PNG')
    print(f'[process-ui-btn] {src.name} -> {dst} ({out.size})')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: process-ui-btn.py <src.png> <dst.png>')
        sys.exit(1)
    process(Path(sys.argv[1]), Path(sys.argv[2]))
