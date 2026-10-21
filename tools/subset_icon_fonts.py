#!/usr/bin/env python3
"""Shrinks the icon fonts bundled into the APK to the glyphs the app actually uses.

Runs in CI before `expo prebuild` (needs `pip install fonttools`). Every quoted kebab-case string in
src/ that matches an icon name is kept, so icon names passed through props or ternaries are covered.
If anything looks wrong the original font is restored, so a failure can only cost size, never icons.
"""
import json
import re
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons"
FONTS = {"Ionicons": "Ionicons", "MaterialCommunityIcons": "MaterialCommunityIcons"}

literal = re.compile(r"""['"`]([a-z0-9]+(?:-[a-z0-9]+)*)['"`]""")


def used_strings() -> set[str]:
    found: set[str] = set()
    for path in (ROOT / "src").rglob("*.ts*"):
        found.update(literal.findall(path.read_text(encoding="utf-8", errors="ignore")))
    return found


def main() -> int:
    strings = used_strings()
    for family, name in FONTS.items():
        glyphmap = json.loads((VENDOR / "glyphmaps" / f"{name}.json").read_text())
        font_path = VENDOR / "Fonts" / f"{name}.ttf"
        wanted = {glyphmap[s] for s in strings if s in glyphmap}
        if not wanted:
            print(f"{family}: no icons found, leaving the font alone")
            continue
        backup = font_path.with_suffix(".ttf.orig")
        shutil.copyfile(font_path, backup)
        before = font_path.stat().st_size
        try:
            options = subset.Options()
            options.layout_features = []
            options.hinting = False
            options.glyph_names = False
            options.notdef_outline = True
            options.name_IDs = [1, 2, 3, 4, 6]
            font = TTFont(str(backup))
            subsetter = subset.Subsetter(options)
            subsetter.populate(unicodes=sorted(wanted))
            subsetter.subset(font)
            font.save(str(font_path))
            cmap = TTFont(str(font_path)).getBestCmap()
            missing = [hex(cp) for cp in wanted if cp not in cmap]
            if missing:
                raise RuntimeError(f"missing glyphs after subsetting: {missing[:5]}")
            print(f"{family}: {len(wanted)} icons, {before // 1024} KB -> {font_path.stat().st_size // 1024} KB")
        except Exception as e:  # restore and continue: a larger APK beats broken icons
            shutil.copyfile(backup, font_path)
            print(f"{family}: subsetting failed ({e}); original font kept", file=sys.stderr)
        finally:
            backup.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
