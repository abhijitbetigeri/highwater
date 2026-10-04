#!/usr/bin/env python3
"""Render frames/beat-N.txt (ANSI) to 1920x1080 PNGs.

Avoids screen capture entirely: the video is generated from the program's real
output, so it needs no recording permission and is byte-identical every run.

Bottom-anchored like a real terminal — when the output grows past the window,
the oldest lines scroll off the top.
"""

import re
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
PAD_X, PAD_Y = 56, 48
FONT_PATH = "/System/Library/Fonts/Menlo.ttc"
SIZE = 20
LEADING = 1.42

BG = (7, 9, 11)
PALETTE = {
    "fg":   (214, 221, 229),
    "dim":  (125, 136, 148),
    "red":  (255, 107, 107),
    "green": (91, 217, 154),
    "amber": (240, 198, 116),
}

ANSI = re.compile(r"\x1b\[([0-9;]*)m")
CODE_TO_COLOR = {"31": "red", "32": "green", "33": "amber", "2": "dim"}


def spans(line):
    """[(text, color_key, bold)] for one line."""
    out, pos, color, bold = [], 0, "fg", False
    for m in ANSI.finditer(line):
        if m.start() > pos:
            out.append((line[pos:m.start()], color, bold))
        for code in (m.group(1) or "0").split(";"):
            if code in ("", "0"):
                color, bold = "fg", False
            elif code == "1":
                bold = True
            elif code in CODE_TO_COLOR:
                color = CODE_TO_COLOR[code]
        pos = m.end()
    if pos < len(line):
        out.append((line[pos:], color, bold))
    return out


def main(beat, src, dst):
    regular = ImageFont.truetype(FONT_PATH, SIZE, index=0)
    try:
        bold_font = ImageFont.truetype(FONT_PATH, SIZE, index=1)
    except Exception:
        bold_font = regular

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    advance = d.textlength("M", font=regular)
    line_h = int(SIZE * LEADING)
    rows = (H - PAD_Y * 2) // line_h

    lines = open(src, encoding="utf-8").read().split("\n")
    # Bottom-anchor: keep the tail that fits, like a scrolling terminal.
    if len(lines) > rows:
        lines = lines[-rows:]

    y = PAD_Y
    for line in lines:
        x = PAD_X
        for text, color, bold in spans(line):
            if text:
                d.text((x, y), text, font=bold_font if bold else regular,
                       fill=PALETTE[color])
                x += advance * len(text)
        y += line_h

    # Quiet beat marker, bottom right.
    d.text((W - PAD_X - 120, H - PAD_Y - 6), f"{beat}/6",
           font=regular, fill=(52, 60, 68))

    img.save(dst)
    print(f"  {dst}  ({len(lines)} lines)")


if __name__ == "__main__":
    for n in range(1, 7):
        main(n, f"frames/beat-{n}.txt", f"frames/beat-{n}.png")
