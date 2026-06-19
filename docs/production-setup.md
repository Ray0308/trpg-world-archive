# 本番セットアップ手順

テスト用の列ずれを残さず、本番運用を始めるためのチェックリストです。

## 全体像

```
Googleフォーム → GAS (onFormSubmit) → NPCS シート → GAS (doGet) → GitHub Pages
組織・シナリオ・PC → data/*.json（当面は手動管理）
```

---

## 1. スプレッドシートをきれいにする

### 推奨：NPCS シートを作り直す

1. Apps Script に `docs/gas-npc-form.gs` をすべて貼り付け
2. エディタで **`resetNpcSheetForProduction_`** を選び **実行**（1回のみ）
3. 結果：
   - 旧 `NPCS` → `NPCS_archive_2026-06-18` などに退避
   - 新 `NPCS` → 正しいヘッダーだけの空シート

### 新シートのヘッダー（1行目）

```
id, name, furigana, birth_date, age, nationality, birth_place, occupation, status,
organization_names, organization_ids, image_url, profile, person, episodes,
scenario_ids, related_npc_ids, contactable_pc_ids, location_ids, memo, edit_url,
form_response_id, created_at, updated_at
```

**含めない列：** `personality`（旧テスト用。本番は `person` を使う）

### 初期データの入れ方

| 方法 | 向いている場合 |
|------|----------------|
| **フォームから再登録** | 本番データが少ない（H.P.ラヴクラフト1件など） |
| **アーカイブから手動コピー** | 列を `personality` → `person` に移して貼り付け |

---

## 2. Apps Script

| 項目 | 内容 |
|------|------|
| コード | `docs/gas-npc-form.gs` を反映 |
| トリガー | `onNpcFormSubmit` → フォーム送信時 |
| デプロイ | ウェブアプリ → **新バージョン** → アクセス: **全員** |
| 確認 | `…/exec?type=npcs` で `person`, `episodes` 等が JSON に出るか |

`memo` / `edit_url` は API に出さない設定済み（サイトにも非表示）。

---

## 3. GitHub Pages（サイト）

未 push の変更を本番反映：

- NPC 表示を DB 列に合わせた整理（`profile` / `person` / `personality`）
- 画像プロキシ（Google Drive）
- ドキュメント類

```powershell
cd "c:\Users\開発用\Desktop\TRPG"
git add -A
git commit -m "Align NPC display with spreadsheet schema and add production GAS docs"
git push origin main
```

反映後: https://ray0308.github.io/trpg-world-archive/

---

## 4. 本番確認チェックリスト

- [ ] API に H.P.ラヴクラフト（または登録 NPC）が返る
- [ ] 画像が表示される
- [ ] 人物紹介・性格（人物情報）が表示される
- [ ] フォーム送信 → NPCS シートに全列が入る
- [ ] サイトに新規 NPC が出る（キャッシュクリア or Ctrl+Shift+R）
- [ ] `kp.html` のフォームリンクが正しい

---

## 5. 運用メモ

| データ | 入力 | 公開 |
|--------|------|------|
| NPC | Googleフォーム | API 自動 |
| 組織・シナリオ・PC | 当面 JSON 編集 + push | GitHub Pages |
| 組織リンク | `organization_ids` に `org-miskatonic-univ` 等形式 | サイト側 JSON の id と一致させる |

列を増やしたら `getNpcHeaders_()` と `buildNpcRowFromAnswers_()` も更新し、再デプロイしてください。
