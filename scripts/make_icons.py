#!/usr/bin/env python3
"""Generates the app icons without third-party dependencies."""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
SS = 4  # supersampling factor


def rounded_rect(x, y, left, top, right, bottom, radius):
    if x < left or x > right or y < top or y > bottom:
        return False
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def sample(x, y, size):
    """Returns RGBA for a point in [0, size) coordinates."""
    unit = size / 100.0
    # Rounded square background with a subtle vertical gradient.
    if not rounded_rect(x, y, 0, 0, size, size, 22 * unit):
        return (0, 0, 0, 0)
    t = y / size
    background = (
        int(34 - 24 * t),
        int(34 - 24 * t),
        int(41 - 27 * t),
        255,
    )
    # The island pill in the middle.
    pill_left, pill_right = 19 * unit, 81 * unit
    pill_top, pill_bottom = 40 * unit, 60 * unit
    if rounded_rect(x, y, pill_left, pill_top, pill_right, pill_bottom, 10 * unit):
        if size >= 48:
            dot_cx, dot_cy, dot_r = 31 * unit, 50 * unit, 5 * unit
            if (x - dot_cx) ** 2 + (y - dot_cy) ** 2 <= dot_r ** 2:
                return (124, 140, 255, 255)
        return (247, 247, 250, 255)
    return background


def render(size):
    rows = []
    for py in range(size):
        row = bytearray()
        row.append(0)  # filter type: none
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    sample_x = px + (sx + 0.5) / SS
                    sample_y = py + (sy + 0.5) / SS
                    sr, sg, sb, sa = sample(sample_x, sample_y, size)
                    r += sr * sa
                    g += sg * sa
                    b += sb * sa
                    a += sa
            total = SS * SS
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes((r // a, g // a, b // a, a // total))
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def png_bytes(size):
    header = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return header + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(render(size), 9)) + chunk(b"IEND", b"")


def ico_bytes(sizes):
    images = [(size, png_bytes(size)) for size in sizes]
    header = struct.pack("<HHH", 0, 1, len(images))
    entries = b""
    offset = 6 + 16 * len(images)
    payload = b""
    for size, data in images:
        entries += struct.pack(
            "<BBBBHHII",
            0 if size >= 256 else size,
            0 if size >= 256 else size,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        offset += len(data)
        payload += data
    return header + entries + payload


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png"), (512, "icon.png")]:
        (OUT / name).write_bytes(png_bytes(size))
    (OUT / "icon.ico").write_bytes(ico_bytes([16, 24, 32, 48, 64, 128, 256]))
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
