# マリウスの露天商 — セットアップ

菌糸コインで商品を売るショップです。PL識別・残高はミ＝ゴキャッチャーと共通です。

---

## やること一覧

| # | 何をする | 誰が |
|---|---------|------|
| 1 | `docs/gas-npc-form.gs` を GAS に反映して **再デプロイ** | サイト管理者 |
| 2 | 商品登録用 Google フォームを作成し、回答先を DBPJ に設定 | サイト管理者 |
| 3 | `docs/gas-shop-form-bound.gs` をフォーム側スクリプトへ貼り、送信トリガー設定 | サイト管理者 |
| 4 | `js/links.js` の `shopForm` にフォーム URL を貼る | サイト管理者 |
| 5 | KPページで在庫・公開を操作 / PL が購入 | KP・PL |

シート `MIGO_SHOP_PRODUCTS` / `MIGO_SHOP_PURCHASES` は初回 API 利用時に自動作成されます。

---

## 手順 1 — GAS 再デプロイ

1. Apps Script で **NPCPJ**（公開 API）を開く  
2. `docs/gas-npc-form.gs` を `Code.gs` に全文コピーして保存  
3. **デプロイ → 管理 → 編集 → 新バージョン → デプロイ**

確認:

```
.../exec?type=migo-shop-catalog
```

→ `{"ok":true,"shop_name":"マリウスの露天商","products":[...]}`

`unknown type` なら再デプロイ不足です。

---

## 手順 2 — 商品登録フォーム

質問タイトル（推奨）:

| タイトル | 種類 | 必須 |
|---------|------|------|
| 商品名 | 短文 | ✅ |
| 商品説明 | 段落 | |
| 商品画像 | ファイル | |
| 価格 | 短文（数字） | ✅ |
| 在庫数 | 短文（数字） | ✅ |
| 備考 | 短文 | |

- 回答の送信先: **アーカイブスプレッドシート（DBPJ）**
- 商品 ID は `shop_001` 形式で自動採番
- 表示順はフォーム項目にしない（シート既定値。並びは名前などでも可）
- フォーム編集で再送した場合: 名前・説明・画像・価格は更新、**在庫・公開・削除は KP 側を優先して維持**

---

## 手順 3 — フォーム側スクリプト

1. フォーム → スクリプトエディタ  
2. `docs/gas-shop-form-bound.gs` を貼り付け  
3. トリガー: `onShopFormSubmit` / フォーム送信時  
4. （任意）`importAllShopResponses` で既存回答を一括取込  

---

## 手順 4 — KP カードのフォーム URL

`js/links.js`:

```js
shopForm: 'https://docs.google.com/forms/d/e/...../viewform',
```

`#` のままだと KP カードは「準備中」表示です。

---

## PL / KP 画面

| 画面 | 内容 |
|------|------|
| サイドバー「マリウスの露天商」 | `games/migo-shop.html` |
| KP「露天商・商品登録フォーム」 | フォーム新規 |
| KP オマケ通貨内「マリウスの露天商（KP）」 | 在庫・公開・論理削除・購入履歴 |

店員画像は `games/migo-shop.js` の `SHOPKEEPER_IMAGE`（既定: `images/yokofolia-mascot.png`）。Drive URL に差し替え可。

---

## API 一覧

| type | 用途 |
|------|------|
| `migo-shop-catalog` | 公開商品 |
| `migo-shop-buy` | 購入（`player_name`, `product_id`, 任意 `client_request_id`） |
| `migo-shop-kp-list` | KP商品一覧（`kp=1`） |
| `migo-shop-kp-set-stock` | 在庫更新 |
| `migo-shop-kp-set-active` | 公開切替 |
| `migo-shop-kp-delete` | 論理削除 |
| `migo-shop-kp-sales` | 購入履歴 |

購入は `LockService` で直列化し、残高確認 → コイン減算 → 在庫 −1 → 履歴追記の順です。
