"""
Cut individual hex tiles from the Battle Masters board mat image.

Parameters from the hex-cutter alignment tool:
  hexSize=41.5  offX=59.5  offY=57
"""

import math
import os
from PIL import Image, ImageDraw

# ─── Parameters ───────────────────────────────────────────────
HEX_SIZE = 41.5      # radius in pixels (center to vertex)
OFFSET_X = 59.5      # pixel offset of hex (0,0) center
OFFSET_Y = 57.0      # pixel offset of hex (0,0) center
BOARD_WIDTH = 13
BOARD_HEIGHT = 12

SRC_IMAGE = os.path.join(os.path.dirname(__file__),
    '..', 'potential_assets', 'Fly-Xwires-BM-Mat-Low-Res.jpg')
OUT_DIR = os.path.join(os.path.dirname(__file__),
    '..', 'packages', 'client', 'public', 'assets', 'terrain', 'hex-tiles')

SQRT3 = math.sqrt(3)


def hex_to_pixel(col: int, row: int) -> tuple[float, float]:
    """Convert hex grid coord to pixel position (pointy-top, even-r offset)."""
    x = HEX_SIZE * SQRT3 * (col + 0.5 * (1 - (row & 1))) + OFFSET_X
    y = HEX_SIZE * 1.5 * row + OFFSET_Y
    return x, y


def hex_mask(w: int, h: int) -> Image.Image:
    """Create a hex-shaped alpha mask (pointy-top)."""
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = w / 2, h / 2
    points = []
    for i in range(6):
        angle = (math.pi / 3) * i + math.pi / 6
        px = cx + HEX_SIZE * math.cos(angle)
        py = cy + HEX_SIZE * math.sin(angle)
        points.append((px, py))
    draw.polygon(points, fill=255)
    return mask


def main():
    src = Image.open(SRC_IMAGE).convert('RGBA')
    os.makedirs(OUT_DIR, exist_ok=True)

    tile_w = int(math.ceil(SQRT3 * HEX_SIZE))
    tile_h = int(math.ceil(2 * HEX_SIZE))
    mask = hex_mask(tile_w, tile_h)

    count = 0
    for row in range(BOARD_HEIGHT):
        num_cols = BOARD_WIDTH - 1 if (row % 2 == 0) else BOARD_WIDTH
        for col in range(num_cols):
            cx, cy = hex_to_pixel(col, row)

            # Crop region centered on hex
            left = int(round(cx - tile_w / 2))
            top = int(round(cy - tile_h / 2))

            # Crop from source (pad with transparent if out of bounds)
            tile = Image.new('RGBA', (tile_w, tile_h), (0, 0, 0, 0))
            # Calculate overlap with source image
            src_left = max(0, left)
            src_top = max(0, top)
            src_right = min(src.width, left + tile_w)
            src_bottom = min(src.height, top + tile_h)

            if src_right > src_left and src_bottom > src_top:
                crop = src.crop((src_left, src_top, src_right, src_bottom))
                paste_x = src_left - left
                paste_y = src_top - top
                tile.paste(crop, (paste_x, paste_y))

            # Apply hex mask
            tile.putalpha(mask)

            filename = f'hex_{col}_{row}.png'
            tile.save(os.path.join(OUT_DIR, filename))
            count += 1

    print(f'Exported {count} hex tiles to {OUT_DIR}')


if __name__ == '__main__':
    main()
