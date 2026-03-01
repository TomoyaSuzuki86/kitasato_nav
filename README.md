# Kitasato Nav

相模大野駅北口 ⇄ 北里大学病院の次便を表示するPWAです。  
フロントエンドのみで動作し、時刻表と祝日データは静的JSONを使用します。

## 主な仕様

- 方向別に次便を表示（現在は2件表示）
- ダイヤ種別（平日/土曜/休日）は自動判定
- 20秒ごとに自動更新
- 1件目カードのみGoogle Maps連携
- 2件目カードは非リンク（補助表示）
- PWA対応（Service Worker / manifest）

## データファイル

- `build/timetables.json`
  - `scripts/kanachu_print_to_json.mjs` で生成
  - 公式ページから時刻表を取得
  - 到着時刻計算は `durationByTime`（便ごとの所要時間）を優先し、未取得時は `approxDurationMins` を使用
  - `K2S-S25` は通常ページで不足するため、別公式ページ（`timetable01`系）から補完

- `build/holidays.json`
  - `scripts/refresh_holidays_json.mjs` で生成
  - 内閣府公式CSV（`https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv`）を取得して更新
  - 実行年 + 翌年の祝日を出力

## 手動更新コマンド

```bash
node scripts/kanachu_print_to_json.mjs
node scripts/refresh_holidays_json.mjs
```

## GitHub Actions（年始自動更新）

`.github/workflows/refresh-static-data-yearly.yml` で、毎年1/1（JST）に以下を実行します。

1. `timetables.json` の更新
2. `holidays.json` の更新
3. 差分があれば自動コミット・自動プッシュ

トリガー:

- `schedule`: `10 15 31 12 *`（UTC。JSTでは1/1 00:10）
- `workflow_dispatch`（手動実行）

