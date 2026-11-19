# ml/ — カメラ認識のモデル・ベクトルDB作成

`/app/camera`（Web版カメラ認識）用のONNXモデルと特徴ベクトルDBを作成する。

## セットアップ

```bash
pip install -r ml/requirements.txt
```

## 手順

1. **画像収集**: `ml/data/images/` に `<id>.png` 形式で公式画像を置く
   （`<id>` は `generated-data/index.json` の `id`。例: `0001_00000000_0_000_0.png`）
   - `ml/data/ids_dex151.txt` に初代151匹分のid一覧がある
   - 画像は pokedex-online.jp の `/images/pokemon/<id>.png` から取得したものを使用
2. **モデル変換**: `python ml/export_models.py`
   - YOLO-World（プロンプト固定）と DINOv2 ViT-S/14 を ONNX 化し `public/models/` に出力
3. **ベクトルDB作成**: `python ml/build_index.py`
   - `public/models/embeddings.v1.bin`（正規化済みFloat32ベクトル）と
     `embeddings.v1.json`（行 → id/dex/名前）と `config.json`（閾値等）を出力
4. **評価**: `ml/data/eval/` に `<dex>_<任意>.png` 形式でテスト写真を置き
   `python ml/eval.py` で Top-1/Top-3 正解率と処理時間を確認

## 新しいポケモンの追加

`ml/data/images/` に画像を1枚追加して `build_index.py` を実行するだけでよい（再学習不要）。
`setting.json` の `index.max_dex` を上げると対象範囲を広げられる。

## 設定

`ml/setting.json` にモデル名・閾値・パスをまとめている。
Web側の閾値（`match_threshold` 等）は `build_index.py` が `public/models/config.json` に書き出す。

## モデルサイズ

初回ビルド結果（初代151匹・252枚、int8量子化）:

- detector.v1.onnx: 12.9 MB
- embedder.v1.onnx: 24.0 MB
- embeddings.v1.bin: 0.39 MB（252件 × 384次元）
- 合計: 約37 MB（50 MB以内）

## テスト結果

`eval.py` の結果（テスト写真未収集のため未実施。実機写真を `ml/data/eval/` に集めて実行すること）:

- Top-1: —
- Top-3: —
- 特徴抽出時間: —

## ライセンス

- YOLO-World（Ultralytics）: AGPL-3.0（本リポジトリは AGPL-3.0 で公開。`LICENSE` 参照）
- DINOv2: Apache-2.0
