# 本番セットアップ手順（第一弾）

## 全体像

```
NPC:     Googleフォーム → GAS → NPCS シート → API → GitHub Pages
他:      data/*.json を編集して push
ゲーム:  chaugner-run.js → 同じ GAS → CHAUGNER_SCORES シート（自動作成）
KP:      kp.html（フォームリンク・NPC編集・一覧・PL表示設定）
```

---

## 1. Apps Script

| 項目 | 内容 |
|------|------|
| コード正本 | `docs/gas-npc-form.gs` を `Code.gs` に貼り付け |
| トリガー | `onNpcFormSubmit` → フォーム送信時 |
| デプロイ | ウェブアプリ → **新バージョン** → アクセス: **全員** |
| URL | `js/config.js` の `api.baseUrl` と一致させる |

### 動作確認 URL

| パラメータ | 期待する結果 |
|-----------|-------------|
| `?type=version` | `api_version` が返る |
| `?type=npcs` | NPC 配列 |
| `?type=npcs&kp=1` | 編集URL・`pl_hidden` 付き |
| `?type=chaugner-ranking` | `[]` または記録配列 |

---

## 2. NPCS シート

### 新規セットアップ（推奨）

1. GAS エディタで **`resetNpcSheetForProduction_`** を1回実行
2. 旧シートは `NPCS_archive_*` に退避、新 `NPCS` が空で作成される

### ヘッダー（1行目）

```
id, name, furigana, birth_date, age, nationality, birth_place, occupation, status,
organization_names, organization_ids, image_url, profile, person, episodes,
scenario_ids, related_npc_ids, contactable_pc_ids, location_ids, memo, edit_url,
form_response_id, created_at, updated_at, pl_hidden
```

- `personality` 列は使わない（`person` を使う）
- `pl_hidden` … KP の「表示設定」用（`TRUE` で PL 非表示）
- `CHAUGNER_SCORES` シートはゲーム初回スコア保存時に自動作成

---

## 3. GitHub Pages

```powershell
git push origin main
```

反映先: https://ray0308.github.io/trpg-world-archive/

---

## 4. 本番確認チェックリスト

- [ ] PLサイトで NPC が表示される
- [ ] 画像（Google Drive URL）が表示される
- [ ] 人物紹介・人物情報・エピソードが表示される
- [ ] フォーム送信 → NPCS に行が追加される
- [ ] `kp.html` で NPC 一覧・編集・表示設定が動く
- [ ] チャウグナー・ランでスコアが保存される（`docs/chaugner-run-setup.md`）

---

## 5. 運用メモ

| データ | 入力 | 公開 |
|--------|------|------|
| NPC | Googleフォーム + KP表示設定 | GAS API |
| 組織・シナリオ・PC | `data/*.json` 編集 + push | GitHub Pages |
| ゲームランキング | プレイヤーが自動送信 | `CHAUGNER_SCORES` シート |

列を増やしたら `getNpcHeaders_()` と `buildNpcRowFromAnswers_()` を更新し、GAS を再デプロイしてください。
