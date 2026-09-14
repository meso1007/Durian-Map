#!/usr/bin/env python3
"""`.pen` のロゴフレームを SVG に変換する。

`.pen` は構造化 JSON で、ロゴは素の SVG パス（`geometry`）の集合として入っている。
ラスタ画像を書き出すのではなくここからベクタを起こすことで、
デザイン案とアプリのロゴを 1 つの正に揃えられる。

`.pen` のロゴを直したら、これを流し直して `frontend/public/logo.svg` を作り直すこと。

使い方:
    python3 pen-logo-to-svg.py durian-map-tropical.pen "Durian Logo" ../frontend/public/logo.svg
"""

import json
import sys
from pathlib import Path
from xml.sax.saxutils import quoteattr


def find_frame(doc: dict, name: str) -> dict:
    for child in doc["children"]:
        if child.get("name") == name:
            return child
    raise SystemExit(f"フレームが見つかりません: {name}")


def path_element(node: dict) -> str | None:
    geometry = node.get("geometry")
    if node.get("type") != "path" or not geometry:
        return None  # 空パス（.pen 側に 0x0 のゴミが混じることがある）

    # geometry の座標はパス自身の原点基準なので、x/y を translate で戻す。
    attrs = [f"d={quoteattr(geometry)}"]
    attrs.append(f'transform="translate({node["x"]:g} {node["y"]:g})"')
    attrs.append(f'fill={quoteattr(node.get("fill") or "none")}')

    if node.get("stroke"):
        attrs.append(f'stroke={quoteattr(node["stroke"])}')
        attrs.append(f'stroke-width="{node.get("strokeWidth", 1):g}"')
        for pen_key, svg_key in (("strokeLinejoin", "stroke-linejoin"),
                                 ("strokeLinecap", "stroke-linecap")):
            if node.get(pen_key):
                attrs.append(f'{svg_key}={quoteattr(node[pen_key])}')

    return "  <path " + " ".join(attrs) + "/>"


def main() -> None:
    pen_file, frame_name, out_file = sys.argv[1], sys.argv[2], sys.argv[3]
    doc = json.loads(Path(pen_file).read_text())
    frame = find_frame(doc, frame_name)

    width, height = frame["width"], frame["height"]
    paths = [el for el in map(path_element, frame["children"]) if el]

    # width/height は付けない。viewBox だけにして CSS 側でサイズを決められるようにする。
    svg = "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" role="img">',
        f"  <title>{frame_name}</title>",
        *paths,
        "</svg>",
        "",
    ])
    Path(out_file).write_text(svg)
    print(f"{out_file}: {len(paths)} paths / {width:g}x{height:g}")


if __name__ == "__main__":
    main()
