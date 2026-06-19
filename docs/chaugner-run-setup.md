# チャウグナー・ラン — ランキングシート設定手順

ゲームのスコアを Google スプレッドシートに保存し、歴代 TOP3 を表示するための手順です。

---

## 全体の流れ

```
ゲーム終了
  → chaugner-run.js が GAS にスコア送信
  → GAS が CHAUGNER_SCORES シートに1行追加
  → ゲーム開始/終了画面がランキング TOP3 を取得して表示
```

**必要なもの**
- 既存の NPC 用 Google スプレッドシート（NPC フォームの送信先と同じ）
- 既存の GAS Webアプリ（`docs/gas-npc-form.gs` をデプロイしたもの）

---

## 手順 1 — GAS コードを更新

1. [Google Apps Script](https://script.google.com/) で **NPC フォーム用プロジェクト** を開く
2. `docs/gas-npc-form.gs` の内容を **すべて** `Code.gs` に貼り付けて保存  
   （末尾に `getChaugnerRanking_` / `saveChaugnerScore_` が含まれていることを確認）
3. **デプロイ → デプロイを管理** → 既存 Webアプリを **編集**
4. バージョン: **新バージョン** → **デプロイ**

### 動作確認（ブラウザで開く）

| URL | 期待する結果 |
|-----|-------------|
| `.../exec?type=chaugner-ranking` | `[]` または記録の配列 |
| `.../exec?type=chaugner-score&name=テスト&score=100` | `{"ok":true,"name":"テスト","score":100}` |

---

## 手順 2 — スプレッドシートのシート

### 自動作成（推奨）

**何もしなくて大丈夫です。**

初回スコア保存時に、GAS が自動で `CHAUGNER_SCORES` シートを作ります。

### 手動で作る場合

同じスプレッドシートに新しいシートを追加し、**1行目** に次のヘッダーを入れます。

| A列 | B列 | C列 |
|-----|-----|-----|
| `name` | `score` | `created_at` |

- シート名は **`CHAUGNER_SCORES`**（大文字・スペル厳守）
- 1行目を **固定行** にすると見やすい（任意）

### データ例

| name | score | created_at |
|------|-------|------------|
| たろう | 342 | 2026/06/16 12:34:56 |
| じろう | 128 | 2026/06/16 13:01:22 |
| たろう | 95 | 2026/06/16 11:00:00 |

- **同じ名前が複数回** 入っても OK（ランキングはスコア順）
- `score` は **整数（m）**
- `created_at` は保存時に GAS が自動入力

---

## 手順 3 — ゲーム側の GAS URL 設定

`games/chaugner-run.js` を開き、`GAS_ENDPOINT` に **手順1と同じ Webアプリ URL** を設定します。

```javascript
const GAS_ENDPOINT = 'https://script.google.com/macros/s/あなたのID/exec';
```

保存 → GitHub に push → 1〜2分後にサイトに反映。

---

## ランキングのルール

| 項目 | 内容 |
|------|------|
| 表示件数 | 歴代 **上位3件** |
| 並び順 | スコア **降順** |
| 同点 | `created_at` が **早い** 方を上位 |
| 同名 | 複数ランクイン可 |

---

## トラブルシューティング

| 症状 | 原因と対処 |
|------|-----------|
| 「ランキング未設定」 | `GAS_ENDPOINT` が空 → URL を設定して push |
| 「ランキング取得に失敗」 | GAS 未デプロイ or URL 間違い → 手順1を再確認 |
| スコアが保存されない | `?type=chaugner-score&...` をブラウザで直接叩いてエラー確認 |
| シートができない | GAS の実行アカウントにスプレッドシート編集権限があるか確認 |
| `unknown type` | 古い GAS が動いている → **新バージョン** で再デプロイ |

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `games/chaugner-run.js` | ゲーム本体・`GAS_ENDPOINT` |
| `docs/gas-npc-form.gs` | NPC API + チャウグナーラン API（正本） |
| `docs/gas-chaugner-run.gs` | チャウグナー部分のみの抜粋（参考） |
