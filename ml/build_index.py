# 画像フォルダからポケモンの特徴ベクトルDB (embeddings.bin / embeddings.json) と
# Web用設定 (config.json) を生成する
# 画像ファイル名は generated-data/index.json の id（例: 0001_00000000_0_000_0.png）
# 使い方: python ml/build_index.py
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SETTING = json.loads((ROOT / "ml" / "setting.json").read_text(encoding="utf-8"))

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def preprocess(path: Path, size: int) -> np.ndarray:
    img = Image.open(path).convert("RGB").resize((size, size), Image.BICUBIC)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - MEAN) / STD
    return arr.transpose(2, 0, 1)[None]


def load_meta(index_json: Path, pokemon_dir: Path, max_dex: int) -> list[dict]:
    entries = json.loads(index_json.read_text(encoding="utf-8"))
    meta = []
    for entry in entries:
        if entry["dex"] > max_dex:
            continue
        pokemon_path = pokemon_dir / f"{entry['id']}.json"
        names = {"jpn": entry["name"]}
        if pokemon_path.exists():
            pokemon = json.loads(pokemon_path.read_text(encoding="utf-8"))
            names = pokemon.get("names") or names
        meta.append({"id": entry["id"], "dex": entry["dex"], "name": entry["name"], "names": names})
    return meta


def main() -> None:
    cfg = SETTING["index"]
    size = SETTING["embedder"]["image_size"]
    images_dir = ROOT / cfg["images_dir"]
    meta = load_meta(ROOT / cfg["index_json"], ROOT / cfg["pokemon_dir"], cfg["max_dex"])

    session = ort.InferenceSession(str(ROOT / SETTING["embedder"]["output"]))
    input_name = session.get_inputs()[0].name

    vectors = []
    rows = []
    for entry in meta:
        path = images_dir / f"{entry['id']}.png"
        if not path.exists():
            print(f"skip (画像なし): {path.name}")
            continue
        out = session.run(None, {input_name: preprocess(path, size)})[0]
        vec = out.reshape(-1).astype(np.float32)
        vec /= np.linalg.norm(vec) + 1e-8
        vectors.append(vec)
        rows.append({"id": entry["id"], "dex": entry["dex"], "name": entry["name"], "names": entry["names"]})

    if not vectors:
        raise SystemExit(f"画像が見つかりません: {images_dir}")

    mat = np.stack(vectors)
    bin_out = ROOT / cfg["output_bin"]
    json_out = ROOT / cfg["output_json"]
    bin_out.parent.mkdir(parents=True, exist_ok=True)
    mat.tofile(bin_out)
    json_out.write_text(
        json.dumps({"dim": int(mat.shape[1]), "rows": rows}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"{len(rows)}件 x {mat.shape[1]}次元 -> {bin_out} ({bin_out.stat().st_size / 1e6:.2f} MB), {json_out}")

    web_cfg = dict(SETTING["web_config"])
    config_out = ROOT / web_cfg.pop("output")
    config_out.write_text(json.dumps(web_cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"-> {config_out}")


if __name__ == "__main__":
    main()
