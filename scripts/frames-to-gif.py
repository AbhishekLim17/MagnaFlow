"""PNG frames (sorted by name) -> a looping GIF for the Features page.

    python scripts/frames-to-gif.py <frames-dir> <out.gif> [width]

Scaled down (default 800px wide) and limited to 96 colours to keep it small.
Used by scripts/capture-feature-media.cjs.
"""
import sys
from pathlib import Path

from PIL import Image

frames_dir, out = Path(sys.argv[1]), Path(sys.argv[2])
width = int(sys.argv[3]) if len(sys.argv) > 3 else 800

frames = []
for f in sorted(frames_dir.glob("*.png")):
    img = Image.open(f).convert("RGB")
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    frames.append(img.quantize(colors=96, method=Image.Quantize.MEDIANCUT))

frames[0].save(out, save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True)
print(f"  saved {out.name} ({len(frames)} frames, {out.stat().st_size // 1024} KB)")
