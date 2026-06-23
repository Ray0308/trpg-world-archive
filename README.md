# YOKOFOLIA ふわっと住民台帳

クトゥルフ神話TRPG向けの世界観アーカイブ（第一弾）。

- **公開サイト（PL）**: https://ray0308.github.io/trpg-world-archive/
- **KP入力ページ**: `kp.html`（noindex・URLは共有範囲を限定）

## 第一弾の範囲

| 機能 | 状態 |
|------|------|
| PLサイト（ホーム・NPC・組織・シナリオ・PC） | ✅ |
| NPC登録（Googleフォーム → GAS API） | ✅ |
| KPページ（登録・編集・一覧・PL表示設定） | ✅ |
| チャウグナー・ラン（オマケゲーム + ランキング） | ✅ |
| 組織・シナリオ・PCフォーム | 組織フォーム準備中（`docs/organization-form-setup.md`） / 他は JSON |

## データの流れ

```
NPC:  Googleフォーム → GAS → NPCSシート → API → サイト
他:   data/*.json を GitHub に push → サイト
ゲーム: chaugner-run.js → 同じ GAS → CHAUGNER_SCORES シート
```

## 設定ファイル

| ファイル | 内容 |
|---------|------|
| `js/config.js` | GAS API URL |
| `js/links.js` | フォーム・外部リンク（Discord 等） |

GAS の正本コード: `docs/gas-npc-form.gs`

## ローカル確認

静的ファイルのため HTTP サーバー経由で開いてください（Live Server 等）。

```powershell
# 例: Python
python -m http.server 8080
```

## ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/production-setup.md` | 本番セットアップ・確認チェックリスト |
| `docs/organization-form-setup.md` | 組織登録フォームの作り方 |
| `docs/chaugner-run-setup.md` | チャウグナー・ランのランキング設定 |
| `docs/gas-npc-export.md` | GAS / シート列の参考 |

## ファイル構成

```
index.html          … PLサイト
kp.html / kp.js     … KP入力ページ
script.js / style.css
games/chaugner-run.* … オマケゲーム
js/
  config.js / links.js / image-utils.js
  data/
    provider.js           … データ取得の入口
    apps-script-provider.js … NPC API
    json-provider.js        … 組織・シナリオ・PC JSON
    normalize.js
data/
  npcs.json             … NPC API 失敗時のフォールバック
  organizations.json
  scenarios.json
  pcs.json
  locations.json
docs/
  gas-npc-form.gs       … GAS 正本（NPC + ランキング + 表示設定）
```
