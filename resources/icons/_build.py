"""生成 Saltalk 应用图标的多尺寸 PNG 与多尺寸 .ico。"""
from pathlib import Path
from PIL import Image

ICONS = Path(r"C:\Users\20179\Desktop\NACL的APP\resources\icons")
SIZES = [512, 256, 128, 64, 48, 32, 16]


def resize_save(src: Path, base: str, sizes):
    img = Image.open(src).convert("RGBA")
    for s in sizes:
        out = ICONS / f"{base}-{s}.png"
        img.resize((s, s), Image.LANCZOS).save(out, "PNG", optimize=True)
        print(f"  {out.name}  ({s}x{s})")
    return img


def make_ico(sizes):
    """生成多尺寸 .ico（PNG 嵌入，Vista+ 标准）"""
    imgs = []
    for s in sizes:
        p = ICONS / f"app-icon-{s}.png"
        if not p.exists():
            # 如果没有该尺寸，从 1024 缩放
            src = Image.open(ICONS / "app-icon-1024.png").convert("RGBA")
            imgs.append(src.resize((s, s), Image.LANCZOS))
        else:
            imgs.append(Image.open(p).convert("RGBA"))
    ico_path = ICONS / "app-icon.ico"
    imgs[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=imgs[1:],
    )
    print(f"  {ico_path.name}  (sizes={sizes})")


def main():
    print("[1/2] Resize app-icon ...")
    resize_save(ICONS / "app-icon-1024.png", "app-icon", SIZES)
    print("[2/2] Build .ico ...")
    make_ico([256, 128, 64, 48, 32, 16])
    print("\nAll files:")
    for p in sorted(ICONS.iterdir()):
        if p.suffix in {".png", ".ico", ".svg"}:
            print(f"  {p.name:30s}  {p.stat().st_size:>8d} B")


if __name__ == "__main__":
    main()
