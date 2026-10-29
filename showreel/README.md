# tkc-works Showreel 2026

17秒 / 1920×1080 / 60fps のショーリール（アトリエ版 v3：4つ目のアプリ「おうちルール」の場面を追加し、ABOUT の文言・APPS の数を今のサイトに合わせたもの）。完成版は `tkc-works_showreel_2026.mp4`。

映像は Canvas 2D（`reel.js`）、音楽は Node でのコード生成（`audio.cjs`）。どちらも時間だけで決まるので、同じ入力からは毎回同じ動画が出ます。

## 構成

| 秒 | 場面 |
|---|---|
| 0–2 | LIGHTS ON（APP DEVELOPMENT） |
| 2–3.9 | CONCEPT（つくることで、もっと楽しく。） |
| 3.9–6 | FLOOR No.01 しのばせトーク |
| 6–8.1 | FLOOR No.02 おえかき探偵団 |
| 8.1–10 | FLOOR No.03 のぼるひと |
| 10–12 | FLOOR No.04 おうちルール（ハンコ・通帳） |
| 12–14.5 | ATELIER（小さなアトリエから、毎日の「楽しい」を、ひとつずつ。） |
| 14.5–17 | END CARD |

アプリを足すときは、アプリの場面関数を足して `render()` の時間割と HUD の `SCENES` をずらし、うしろの場面（`s6` / `endCard`）に渡す時間をずらす。音は `audio.cjs` の小節（`roots` / `chords`）と効果音の時刻を同じだけずらす。

## 書き出し手順（このフォルダで実行）

```sh
node getfonts.cjs                       # reel.js の文言を変えたら実行（使う文字だけの Google Fonts を fonts/ に取得）
node audio.cjs                          # reel.wav を生成
node render.cjs preview 1.5,4.6,12.9    # 指定秒のフレームを preview/ に JPEG 出力（確認用）
node render.cjs full out.mp4 reel.wav   # 全フレームを書き出して ffmpeg でエンコード
```

必要なもの: Node.js、Playwright（または playwright-core ＋ Chromium）、ffmpeg。場所は環境変数で渡せる（`PLAYWRIGHT` = playwright のパス、`CHROME` = Chromium の実行ファイル、`FFMPEG` = ffmpeg の実行ファイル）。`index.html` をブラウザで開くとリアルタイム再生もできます（`render.cjs` と同じくリポジトリのルートから配信すること）。

サイト用（`assets/`）は 1280×720 に縮めて書き出す: `showreel.mp4`（H.264）・`showreel.webm`（VP9）・`showreel-poster.jpg`（最後のコマ）。
