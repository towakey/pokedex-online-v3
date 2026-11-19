# テスト写真で Top-1 / Top-3 正解率と処理時間を計測する
# ml/data/eval/ に「<id>_<任意>.jpg|png」形式でテスト写真を置く（id = index.json の id）
# 使い方: python ml/eval.py
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SETTING = json.loads((ROOT / "ml" / "setting.json").read_text(encoding="utf-8"))

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def embed(session, input_name: str, img: Image.Image, size: int) -> np.ndarray:
    arr = np.asarray(img.convert("RGB").resize((size, size), Image.BICUBIC), dtype=np.float32) / 255.0
    arr = ((arr - MEAN) / STD).transpose(2, 0, 1)[None]
    vec = session.run(None, {input_name: arr})[0].reshape(-1).astype(np.float32)
    return vec / (np.linalg.norm(vec) + 1e-8)


def main() -> None:
    eval_dir = ROOT / SETTING["eval"]["images_dir"]
    files = sorted(p for p in eval_dir.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"})
    if not files:
        raise SystemExit(f"テスト画像がありません: {eval_dir} （<id>_<任意>.png 形式で置いてください）")

    size = SETTING["embedder"]["image_size"]
    session = ort.InferenceSession(str(ROOT / SETTING["embedder"]["output"]))
    input_name = session.get_inputs()[0].name

    index = json.loads((ROOT / SETTING["index"]["output_json"]).read_text(encoding="utf-8"))
    db = np.fromfile(ROOT / SETTING["index"]["output_bin"], dtype=np.float32).reshape(-1, index["dim"])
    ids = [row["id"] for row in index["rows"]]
    dexes = [row["dex"] for row in index["rows"]]

    top1 = top3 = 0
    times = []
    for path in files:
        answer_dex = int(path.name.split("_")[0])
        img = Image.open(path)
        start = time.perf_counter()
        vec = embed(session, input_name, img, size)
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        scores = db @ vec
        order = np.argsort(-scores)
        top_ids = [(ids[i], dexes[i], float(scores[i])) for i in order[:3]]
        if top_ids[0][1] == answer_dex:
            top1 += 1
        if any(d == answer_dex for _, d, _ in top_ids):
            top3 += 1
        print(f"{path.name}: top1={top_ids[0]} top3={top_ids} ({elapsed * 1000:.0f}ms)")

    n = len(files)
    print(f"\nTop-1: {top1}/{n} ({top1 / n:.1%})  Top-3: {top3}/{n} ({top3 / n:.1%})")
    print(f"特徴抽出: 平均 {np.mean(times) * 1000:.0f}ms/枚")


if __name__ == "__main__":
    main()
