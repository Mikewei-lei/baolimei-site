#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一键替换品牌 logo / favicon / OG 图。

用法：
    python scripts/set-logo.py "D:\\path\\to\\logo.png"

规则：
  * 自动裁掉纯白 / 透明留白，只保留图案本体
  * 生成 public/brand/logo.png（最长边 512，保留透明）
  * 生成 public/icon.png / apple-icon.png / favicon.ico
  * 生成 public/brand/og.jpg（1200×630，深色底 + logo + 品牌名）
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
BRAND = os.path.join(PUBLIC, 'brand')
BG = (7, 8, 10)
ACCENT = (216, 255, 59)
CN_NAME = '葆历莓'
EN_NAME = 'BAOLIMEI'


def load_and_trim(path):
    im = Image.open(path)
    im.load()
    has_alpha = 'A' in im.getbands()
    im = im.convert('RGBA')

    if has_alpha:
        alpha = im.getchannel('A')
        bbox = alpha.getbbox()
        if bbox:
            im = im.crop(bbox)
    else:
        # 白底图：裁掉接近白色的边缘
        rgb = im.convert('RGB')
        white = Image.new('RGB', rgb.size, (255, 255, 255))
        diff = ImageChops.difference(rgb, white).convert('L')
        mask = diff.point(lambda v: 255 if v > 18 else 0)
        bbox = mask.getbbox()
        if bbox:
            im = im.crop(bbox)

    # 去掉边缘 1px 杂边
    w, h = im.size
    if w > 4 and h > 4:
        im = im.crop((1, 1, w - 1, h - 1))
    return im


def fit(im, size, bg=None):
    canvas = Image.new('RGBA', size, bg or (0, 0, 0, 0))
    ratio = min(size[0] / im.width, size[1] / im.height)
    w = max(1, int(im.width * ratio))
    h = max(1, int(im.height * ratio))
    resized = im.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size[0] - w) // 2, (size[1] - h) // 2))
    return canvas


def font(size, bold=False):
    candidates = [
        os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'msyhbd.ttc' if bold else 'msyh.ttc'),
        os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'simhei.ttf'),
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


def make_og(logo):
    W, H = 1200, 630
    canvas = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    # 背景光晕
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-260, -320, 620, 460), fill=(216, 255, 59, 34))
    gd.ellipse((720, 300, 1480, 960), fill=(90, 160, 255, 24))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), glow).convert('RGB')
    draw = ImageDraw.Draw(canvas)

    mark = fit(logo, (132, 132))
    canvas.paste(mark, (88, 128), mark)

    draw.text((250, 138), CN_NAME, font=font(64, True), fill=(243, 245, 241))
    draw.text((253, 214), EN_NAME, font=font(22), fill=(216, 255, 59))

    draw.text((90, 330), '一句话，一支片。', font=font(58, True), fill=(243, 245, 241))
    draw.text((92, 418), 'AI 影视创作平台 · 文生视频 / 图生视频 / 无限画布', font=font(24), fill=(154, 161, 169))
    draw.text((92, 540), 'baolimei.cn', font=font(22), fill=(107, 114, 128))
    canvas.save(os.path.join(BRAND, 'og.jpg'), quality=90, optimize=True)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    if not os.path.exists(src):
        print(f'找不到文件：{src}')
        sys.exit(1)

    logo = load_and_trim(src)
    os.makedirs(BRAND, exist_ok=True)

    mark = logo.copy()
    mark.thumbnail((512, 512), Image.LANCZOS)
    mark.save(os.path.join(BRAND, 'logo.png'), optimize=True)

    # 方形容器版本：避免宽幅 logo 在 32px 圆角块里被裁切
    square = fit(logo, (512, 512))
    square.save(os.path.join(BRAND, 'logo-square.png'), optimize=True)

    fit(logo, (64, 64)).save(os.path.join(PUBLIC, 'icon.png'), optimize=True)
    fit(logo, (180, 180), (7, 8, 10, 255)).save(os.path.join(PUBLIC, 'apple-icon.png'), optimize=True)

    ico = fit(logo, (64, 64))
    ico.save(os.path.join(PUBLIC, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])

    make_og(logo)

    w, h = logo.size
    ratio = w / h if h else 1
    print(f'[OK] 已裁切：{w}×{h}（宽高比 {ratio:.2f}）')
    print('[OK] public/brand/logo.png')
    print('[OK] public/brand/logo-square.png')
    print('[OK] public/brand/og.jpg')
    print('[OK] public/icon.png, apple-icon.png, favicon.ico')
    if ratio > 1.7:
        print('\n提示：这是一个横向组合标（图标 + 文字）。如果希望页头只显示图形，'
              '请再提供一版单独的图形标；当前版本会在 32px 方框内居中缩放。')
    print('\n下一步：npm run build && npm start（或重新部署）')


if __name__ == '__main__':
    main()
