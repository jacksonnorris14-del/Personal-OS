#!/usr/bin/env python3
"""Generate app icons (pure stdlib PNG writer, 4x supersampled).

Mark: an upward chevron (ascent / the summit) with a north-star dot above it —
direction + a fixed point to aim at. Warm accent on near-black, matching the app.
"""
import math, struct, zlib, os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")

BG_TOP = (0x12, 0x14, 0x1A)
BG_BOT = (0x08, 0x09, 0x0B)
MARK_TOP = (0xFF, 0xB0, 0x3A)
MARK_BOT = (0xFF, 0x3B, 0x30)


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    L = vx * vx + vy * vy
    t = 0.0 if L == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / L))
    dx, dy = wx - t * vx, wy - t * vy
    return math.hypot(dx, dy)


def rounded_rect_inside(x, y, w, h, r):
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    return math.hypot(x - cx, y - cy) <= r


def render(size, scale=4, bleed=False, pad_ratio=0.20):
    """bleed=True -> maskable icon: background fills the whole square."""
    S = size * scale
    radius = S * 0.5 if bleed else S * 0.2237  # iOS squircle-ish corner
    # mark geometry
    m = S * (0.30 if bleed else pad_ratio)      # inset for the mark
    cx = S / 2
    span = (S - 2 * m)
    half_w = span * 0.42
    thick = span * 0.185
    apex_y = S * 0.435
    base_y = apex_y + span * 0.30
    dot_r = thick * 0.44
    dot_y = apex_y - thick * 0.62 - dot_r - span * 0.055

    px = bytearray()
    inv = 1.0 / (scale * scale)
    for py in range(size):
        row = bytearray()
        for pxi in range(size):
            acc = [0.0, 0.0, 0.0]
            for sy in range(scale):
                y = (py * scale + sy) + 0.5
                bg = lerp(BG_TOP, BG_BOT, y / S)
                for sx in range(scale):
                    x = (pxi * scale + sx) + 0.5
                    if not rounded_rect_inside(x, y, S, S, radius):
                        continue  # transparent-ish -> stays black w/ alpha below
                    col = bg
                    d = min(
                        seg_dist(x, y, cx - half_w, base_y, cx, apex_y),
                        seg_dist(x, y, cx, apex_y, cx + half_w, base_y),
                    )
                    hit = d <= thick / 2
                    if not hit and math.hypot(x - cx, y - dot_y) <= dot_r:
                        hit = True
                    if hit:
                        t = max(0.0, min(1.0, (y - apex_y + span * 0.22) / (span * 0.55)))
                        col = lerp(MARK_TOP, MARK_BOT, t)
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]
            row += bytes(int(max(0, min(255, round(c * inv)))) for c in acc)
        px += b"\x00" + row
    return png_bytes(size, size, bytes(px))


def png_bytes(w, h, raw):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit truecolor
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def write(name, data):
    p = os.path.join(OUT, name)
    with open(p, "wb") as f:
        f.write(data)
    print(name, len(data), "bytes")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    write("icon-192.png", render(192))
    write("icon-512.png", render(512, scale=3))
    write("apple-touch-icon.png", render(180))      # iOS applies its own mask
    write("maskable-512.png", render(512, scale=3, bleed=True))
    write("favicon-32.png", render(32, scale=8))
