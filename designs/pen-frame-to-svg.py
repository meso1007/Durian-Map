#!/usr/bin/env python3
"""`.pen` のフレームを SVG に変換する。

`.pen` は構造化 JSON で、ロゴやアイコンは素の SVG パス（`geometry`）の集合として入っている。
ラスタを書き出すのではなくここからベクタを起こすことで、デザイン案とアプリのアセットを
1 つの正に保てる。`.pen` を直したら流し直すこと。

パス座標の扱い:
  `geometry` はフレームの座標系をそのまま使い、`width`/`height` はレンダリング後のサイズ。
  よって viewBox を「座標系のサイズ」に合わせ、実寸は width/height 属性ではなく
  呼び出し側の CSS で決める。座標系のサイズは --space で渡す（既定 160）。

使い方:
    python3 pen-frame-to-svg.py <file.pen> <フレーム名> <出力.svg> [--space 160]
"""

import json
import sys
from pathlib import Path
from xml.sax.saxutils import quoteattr


def resolve(value, variables: dict):
    """`.pen` の色は "$lime" のような変数参照になりうるので実値に直す。"""
    if isinstance(value, str) and value.startswith("$"):
        return variables.get(value[1:], {}).get("value")
    return value


def find_frame(doc: dict, name: str) -> dict:
    for child in doc["children"]:
        if child.get("name") == name:
            return child
    raise SystemExit(f"フレームが見つかりません: {name}")


def path_element(node: dict, indent: str, variables: dict) -> str | None:
    geometry = node.get("geometry")
    if node.get("type") != "path" or not geometry:
        return None

    fill = resolve(node.get("fill"), variables) or "none"
    attrs = [f"d={quoteattr(geometry)}", f"fill={quoteattr(fill)}"]

    stroke = resolve(node.get("stroke"), variables)
    if stroke:
        attrs.append(f"stroke={quoteattr(stroke)}")
        attrs.append(f'stroke-width="{node.get("strokeWidth", 1):g}"')
    return f"{indent}<path " + " ".join(attrs) + "/>"


def collect(node: dict, indent: str, out: list[str], variables: dict) -> None:
    """フレームの入れ子をたどってパスだけ拾う（テキストは SVG 側でフォントが要るので扱わない）。"""
    for child in node.get("children", []):
        element = path_element(child, indent, variables)
        if element:
            out.append(element)
        elif child.get("type") == "frame":
            collect(child, indent, out, variables)


def main() -> None:
    pen_file, frame_name, out_file = sys.argv[1], sys.argv[2], sys.argv[3]
    space = 160.0
    if "--space" in sys.argv:
        space = float(sys.argv[sys.argv.index("--space") + 1])

    doc = json.loads(Path(pen_file).read_text())
    variables = doc.get("variables", {})
    frame = find_frame(doc, frame_name)

    body: list[str] = []

    # フレーム自身の塗り（アプリアイコンの背景など）。角丸はフレーム実寸なので座標系へ直す。
    fill = resolve(frame.get("fill"), variables)
    if isinstance(fill, str):
        radius = frame.get("cornerRadius") or 0
        if isinstance(radius, list):
            radius = radius[0]
        scaled = radius * space / frame["width"]
        body.append(
            f'  <rect width="{space:g}" height="{space:g}" rx="{scaled:g}" fill={quoteattr(fill)}/>'
        )

    collect(frame, "  ", body, variables)

    svg = "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {space:g} {space:g}" role="img">',
        f"  <title>{frame_name}</title>",
        *body,
        "</svg>",
        "",
    ])
    Path(out_file).write_text(svg)
    print(f"{out_file}: {len(body)} 要素 / viewBox {space:g}")


if __name__ == "__main__":
    main()
