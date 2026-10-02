# tkc-works ブランド画像

リニューアル後の tkc-works.net（暗いアトリエ × ランプの光）に合わせた画像一式。

## banner/ — 「tkc-works／つくることで、もっと楽しく。」

| ファイル | サイズ | 用途 |
|---|---|---|
| `tkc-works_google-play_4096x2304.jpg` | 4096×2304（約180KB） | Google Play（4096×2304・1MB以下の基準用） |
| `tkc-works_google-play-feature_1024x500.png` | 1024×500 | Google Play フィーチャーグラフィック |
| `tkc-works_x-header_1500x500.png` | 1500×500 | X（旧Twitter）ヘッダー |
| `tkc-works_banner_1920x1080.png` | 1920×1080 | 横長の汎用 |
| `tkc-works_square_1080x1080.png` | 1080×1080 | 正方形（Instagram など） |
| `tkc-works_logo-transparent_2400x900.png` | 2400×900 | 背景透過（暗い背景の上で使用） |

## icon/ — 「tkc.」アイコン

`tkc-works_icon_1024.png`（SNS プロフィールなど）、`_512`、`_180`（iPhone ホーム画面用・角なし）、`tkc-works_favicon_32` / `_16`。
サイトで実際に使っているものは `assets/` 内の同名でないファイル（`icon-512.png` など）です。

## 作り直すとき

Node.js と Playwright（Chromium）が必要です。デザインは `banner/b.html`・`icon/icon.html` を編集します。

```sh
node banner/make.cjs     # SNS 用 5 種を banner/ に出力
node banner/make4k.cjs   # 4096×2304 の元 PNG を出力（JPEG 化は ffmpeg -q:v 1 など）
node icon/make.cjs       # アイコン一式を icon/ に出力（favicon-16.png などの名前で出力されます）
```
