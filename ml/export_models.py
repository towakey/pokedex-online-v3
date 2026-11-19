# YOLO-World (プロンプト固定) と DINOv2 を ONNX に変換して public/models/ に出力する
# 使い方: python ml/export_models.py
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETTING = json.loads((ROOT / "ml" / "setting.json").read_text(encoding="utf-8"))


def export_detector(cfg: dict) -> Path:
    from ultralytics import YOLOWorld

    model = YOLOWorld(cfg["model"])
    model.set_classes(cfg["prompts"])
    out = model.export(format="onnx", imgsz=cfg["image_size"], simplify=True, opset=17)
    return Path(out)


def export_embedder(cfg: dict) -> Path:
    # facebook/dinov2-small = DINOv2 ViT-S/14（出力は last_hidden_state[:,0] のCLSトークン）
    import torch
    from transformers import AutoModel

    model = AutoModel.from_pretrained(cfg["model"])
    model.eval()

    class ClsOnly(torch.nn.Module):
        def __init__(self, base):
            super().__init__()
            self.base = base

        def forward(self, images):
            return self.base(images).last_hidden_state[:, 0]

    size = cfg["image_size"]
    dummy = torch.randn(1, 3, size, size)
    out = Path("dinov2.onnx")
    torch.onnx.export(
        ClsOnly(model),
        dummy,
        str(out),
        input_names=["images"],
        output_names=["embedding"],
        opset_version=17,
        dynamic_axes={"images": {0: "batch"}, "embedding": {0: "batch"}},
    )
    return out


def quantize(src: Path, dst: Path) -> Path:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(str(src), str(dst), weight_type=QuantType.QInt8)
    return dst


def main() -> None:
    det_cfg = SETTING["detector"]
    emb_cfg = SETTING["embedder"]

    print("=== detector (YOLO-World) ===")
    det_onnx = export_detector(det_cfg)
    det_out = ROOT / det_cfg["output"]
    det_out.parent.mkdir(parents=True, exist_ok=True)
    if det_cfg.get("quantize_int8"):
        quantize(det_onnx, det_out)
    else:
        shutil.move(str(det_onnx), det_out)
    print(f"  -> {det_out} ({det_out.stat().st_size / 1e6:.1f} MB)")

    print("=== embedder (DINOv2) ===")
    emb_onnx = export_embedder(emb_cfg)
    emb_out = ROOT / emb_cfg["output"]
    if emb_cfg.get("quantize_int8"):
        quantize(emb_onnx, emb_out)
    else:
        shutil.move(str(emb_onnx), emb_out)
    print(f"  -> {emb_out} ({emb_out.stat().st_size / 1e6:.1f} MB)")

    total = det_out.stat().st_size + emb_out.stat().st_size
    print(f"合計: {total / 1e6:.1f} MB（目安 50MB 以下）")
    if total > 50e6:
        print("WARNING: 50MB を超えています。ユーザーに報告してください", file=sys.stderr)


if __name__ == "__main__":
    main()
