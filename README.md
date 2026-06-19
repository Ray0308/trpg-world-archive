# TRPG World Archive

クトゥルフ神話TRPG向けの世界観アーカイブ（閲覧専用）。

## データ管理

| 役割 | ツール |
|------|--------|
| データ入力（KP） | Googleフォーム |
| データ保存 | Googleスプレッドシート |
| サイト表示 | GitHub Pages（JSON / 将来スプレッドシート） |

サイト内に管理画面はありません。

## ページ構成

| ページ | 対象 | URL |
|--------|------|-----|
| PL（閲覧） | プレイヤー | `index.html` |
| KP（入力） | キーパー | `kp.html`（メニュー非表示・noindex） |

フォーム URL は `js/links.js` の `AppLinks` で管理。スプレッドシート・GAS 管理 URL は載せない。

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

### NPC（現在のスプレッドシート列）

```
id, name, furigana, birth_date, age, nationality, birth_place, occupation, status,
organization_names, organization_ids, image_url, profile, personality, memo, edit_url
```

| 列 | サイト表示 |
|----|-----------|
| `name` 〜 `status` | 基本情報 |
| `organization_names` / `organization_ids` | 所属組織 |
| `image_url` | 画像 |
| `profile` | 人物紹介 |
| `personality` | 性格 |
| `memo`, `edit_url` | 非表示（管理用） |

将来列を追加した場合（`person`, `episodes`, `contactable_pc_ids` 等）はサイト側も対応済み。

### 組織

id, 名称, 説明, 所在地, 概要

### シナリオ

id, 名称, 概要, 年代

### PC

id, 名前, プレイヤー名, 説明

## ローカル確認

JSON は HTTP サーバー経由で開いてください（Live Server 等）。
