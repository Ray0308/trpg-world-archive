# TRPG World Archive

クトゥルフ神話TRPG向けの世界観アーカイブ（閲覧専用）。

## データ管理

| 役割 | ツール |
|------|--------|
| データ入力（KP） | Googleフォーム |
| データ保存 | Googleスプレッドシート |
| サイト表示 | GitHub Pages（JSON / 将来スプレッドシート） |

サイト内に管理画面はありません。

## Ver1（現在）

- **NPC**: [Apps Script Webアプリ](https://script.google.com/macros/s/AKfycbzpuz_aIieBUVLJye3RLmWsBJt6bbfOqaZaxRlqrhHWxcneXCupPergOHY9bDsmo_n2/exec?type=npcs) から取得
- **フォールバック**: API 失敗時は `data/npcs.json`
- **その他**: `data/*.json`（組織・シナリオ・PC）
- 設定: `js/config.js` → `api.baseUrl`

## Ver2（予定）

- データソース: Googleスプレッドシート
- 設定: `js/config.js` → `dataProvider: 'sheets'`
- 実装: `js/data/sheets-provider.js`

## ファイル構成

```
js/
  config.js              … プロバイダ切替
  data/
    provider.js          … loadArchiveData() 統一入口
    json-provider.js     … Ver1
    sheets-provider.js   … Ver2（スタブ）
    normalize.js         … シート列 → 内部モデル
data/
  npcs.json
  organizations.json
  scenarios.json
  pcs.json
  locations.json
script.js                … UI（閲覧専用）
```

## スプレッドシート列（参考）

### NPC

id, 名前, フリガナ, 生年月日, 年齢, 国籍, 出身地, 職業, organization_id, 状態, 人物紹介, 人物, エピソード, 連絡可能PC, 画像URL

### 組織

id, 名称, 説明, 所在地, 概要

### シナリオ

id, 名称, 概要, 年代

### PC

id, 名前, プレイヤー名, 説明

## ローカル確認

JSON は HTTP サーバー経由で開いてください（Live Server 等）。
