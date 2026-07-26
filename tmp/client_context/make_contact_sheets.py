from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def natural_page_number(path: Path) -> int:
    return int(path.stem.rsplit("-", 1)[-1])


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: make_contact_sheets.py <pages_dir> <output_dir>")

    pages_dir = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    pages = sorted(pages_dir.glob("page-*.png"), key=natural_page_number)
    columns = 4
    rows = 4
    items_per_sheet = columns * rows
    thumb_width = 360
    label_height = 28
    padding = 14
    background = "#d7dbe0"
    font = ImageFont.load_default(size=18)

    created: list[str] = []
    for sheet_index in range(math.ceil(len(pages) / items_per_sheet)):
        chunk = pages[sheet_index * items_per_sheet : (sheet_index + 1) * items_per_sheet]
        first = Image.open(chunk[0]).convert("RGB")
        thumb_height = round(first.height * thumb_width / first.width)
        canvas_width = columns * (thumb_width + 2 * padding)
        canvas_height = rows * (thumb_height + label_height + 2 * padding)
        canvas = Image.new("RGB", (canvas_width, canvas_height), background)
        draw = ImageDraw.Draw(canvas)

        for index, page_path in enumerate(chunk):
            page = Image.open(page_path).convert("RGB")
            page.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            col = index % columns
            row = index // columns
            x = col * (thumb_width + 2 * padding) + padding
            y = row * (thumb_height + label_height + 2 * padding) + padding + label_height
            canvas.paste(page, (x, y))
            draw.text(
                (x, y - label_height + 2),
                f"Page {natural_page_number(page_path)}",
                fill="#111827",
                font=font,
            )

        output_path = output_dir / f"contact-{sheet_index + 1:02d}.jpg"
        canvas.save(output_path, quality=88, optimize=True)
        created.append(str(output_path))

    print("\n".join(created))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
