# tkc-works Showreel 2026

15秒 / 1920×1080 / 60fps のショーリール。完成版は `tkc-works_showreel_2026.mp4`。

映像は Canvas 2D（`reel.js`）、音楽は Node でのコード生成（`audio.cjs`）。どちらも時間だけで決まるので、同じ入力からは毎回同じ動画が出ます。

## 書き出し手順（このフォルダで実行）

```sh
python3 getfonts.py                     # reel.js の文言を変えたら実行（使う文字だけの Google Fonts を fonts/ に取得）
node audio.cjs                          # reel.wav を生成
node render.cjs preview 1.5,4.6,12.9    # 指定秒のフレームを preview/ に JPEG 出力（確認用）
node render.cjs full out.mp4 reel.wav   # 900 フレームを書き出して ffmpeg でエンコード
```

必要なもの: Node.js、Playwright（Chromium）、ffmpeg。`index.html` をブラウザで開くとリアルタイム再生もできます（`render.cjs` と同じくリポジトリのルートから配信すること）。
