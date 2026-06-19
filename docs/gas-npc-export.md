# Apps Script — NPC 全項目エクスポート

サイトが NPC 詳細で表示する項目のうち、**人物（家族・ペット・特徴）・エピソード・連絡可能PC・関連情報** は、API レスポンスに含まれている必要があります。

現状の API は基本項目と `profile` / `personality` のみ返している例があります。スプレッドシートに列があっても **GAS の `getNpcData()` が出力していなければサイトに出ません**。

## Googleフォーム → スプレッドシート対応表

フォーム項目（実環境）と、シート列・API キーの対応です。

| フォーム項目 | あるべきシート列 | API キー | いまのシート |
|-------------|-----------------|----------|-------------|
| NPC名 | `name` | `name` | ✅ |
| ふりがな | `furigana` | `furigana` | ✅ |
| 生年月日 | `birth_date` | `birth_date` | ✅ |
| 年齢 | `age` | `age` | ✅ |
| 国籍 | `nationality` | `nationality` | ✅ |
| 出身地 | `birth_place` | `birth_place` | ✅ |
| 職業 | `occupation` | `occupation` | ✅ |
| 状態 | `status` | `status` | ✅ |
| 所属組織 | `organization_names`（＋任意で `organization_ids`） | 同上 | ✅ |
| NPC画像 | `image_url` | `image_url` | ✅ |
| 人物紹介 | `profile` | `profile` | ✅ |
| **人物情報** | **`person`**（JSON 推奨） | `person` | ❌ → `personality` のみ |
| エピソード | `episodes` | `episodes` | ❌ 列なし |
| 登場シナリオ | `scenario_ids` | `scenario_ids` | ❌ 列なし |
| 関連NPC | `related_npc_ids` | `related_npc_ids` | ❌ 列なし |
| 連絡可能PC | `contactable_pc_ids` | `contactable_pc_ids` | ❌ 列なし |
| 関連場所 | `location_ids` | `location_ids` | ❌ 列なし |
| 備考 | `memo` | `memo`（非表示） | ✅ |
| （管理用） | `id`, `edit_url` | 同上 | ✅ |

### 転記ミスになっている点

1. **`personality` 列** — フォームに「性格」単独項目はない。**「12. 人物情報」→ `person` 列** が正しい。`personality` だけだと家族・ペット・特徴が入れられない。
2. **フォーム 13〜17** — エピソード・シナリオ・関連NPC・連絡可能PC・関連場所が **シートに列がない**（フォーム送信時の転記 or シート設計の漏れ）。
3. **サイトは問題なし** — 列と API にデータがあれば表示できる。欠けているのは **フォーム → スプレッドシート → GAS** の途中。

### 人物情報（`person`）の入力例

フォームで自由記述なら、シートには次の JSON を入れるとサイトで「人物」セクションに展開されます。

```json
{"family":"…","pet":"…","traits":"…","personality":"…"}
```

性格だけなら `personality` 列でも可（サイトは「性格」セクションに表示）。

---

## 現在のスプレッドシート列（実環境）

```
id, name, furigana, birth_date, age, nationality, birth_place, occupation, status,
organization_names, organization_ids, image_url, profile, personality, memo, edit_url
```

| 列 | サイト表示 |
|----|-----------|
| `id` 〜 `status` | 基本情報 |
| `organization_names` | 所属組織（テキスト） |
| `organization_ids` | 所属組織（リンク。例: `org-miskatonic-univ`） |
| `image_url` | 画像 |
| `profile` | 人物紹介 |
| `personality` | 人物 → 性格 |
| `memo`, `edit_url` | **非表示**（管理用） |

### まだシートに無い列（追加すると表示される）

| 追加する列（例） | サイト表示 |
|------------------|-----------|
| `person`（JSON）または `family` / `pet` / `traits` | 人物 → 家族・ペット・特徴 |
| `episodes`（JSON 配列） | エピソード |
| `contactable_pc_ids`（カンマ区切り PC id） | 連絡可能PC |
| `scenario_ids` | 関連情報 → 登場シナリオ |
| `related_npc_ids` | 関連情報 → 関連NPC |
| `location_ids` | 関連情報 → 関連場所 |

---

## サイトが期待する API フィールド（参考）

| API キー | スプレッドシート列（例） | 表示先 |
|----------|-------------------------|--------|
| `id` | id | — |
| `name` | 名前 | タイトル |
| `furigana` | フリガナ | タイトル下 |
| `birth_date` | 生年月日 | 基本情報 |
| `age` | 年齢 | 基本情報 |
| `nationality` | 国籍 | 基本情報 |
| `birth_place` | 出身地 | 基本情報 |
| `occupation` | 職業 | 基本情報 |
| `status` | 状態 | 基本情報 |
| `organization_ids` | organization_id | 所属組織（リンク） |
| `organization_names` | （名称のみのとき） | 所属組織（テキスト） |
| `image_url` | 画像URL | 画像 |
| `profile` | 人物紹介 | 人物紹介 |
| `person` | 人物 | 家族・ペット・特徴・性格 |
| `personality` | 性格（単独列の場合） | 性格 |
| `family` / `pet` / `traits` | 各列に分ける場合 | 人物 |
| `episodes` | エピソード | エピソード |
| `contactable_pc_ids` | 連絡可能PC | 連絡可能PC |
| `scenario_ids` | 登場シナリオ | 関連情報 |
| `related_npc_ids` | 関連NPC | 関連情報 |
| `location_ids` | 関連場所 | 関連情報 |

**管理用（サイト非表示）:** `memo`, `edit_url` など

### `person` の形式（どちらか）

**JSON オブジェクト（推奨）**

```json
{
  "family": "父、母…",
  "pet": "猫の名前",
  "traits": "特徴的な外見や癖",
  "personality": "性格"
}
```

**または個別キー:** `family`, `pet`, `traits`, `personality`

### `episodes` の形式

```json
[
  { "icon": "📌", "title": "事件名", "desc": "説明" }
]
```

## getNpcData（現在の列用・コピペ用）

シート名が `NPC` でない場合は `getSheetByName('NPC')` を変更してください。

```javascript
function col(row, headerMap, key) {
  const idx = headerMap[key];
  if (idx === undefined) return '';
  const v = row[idx];
  return v == null ? '' : v;
}

function getNpcData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NPC');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const headerMap = {};
  headers.forEach((h, i) => { headerMap[h] = i; });

  const npcs = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!col(row, headerMap, 'id')) continue;

    const npc = {
      id: col(row, headerMap, 'id'),
      name: col(row, headerMap, 'name'),
      furigana: col(row, headerMap, 'furigana'),
      birth_date: col(row, headerMap, 'birth_date'),
      age: col(row, headerMap, 'age'),
      nationality: col(row, headerMap, 'nationality'),
      birth_place: col(row, headerMap, 'birth_place'),
      occupation: col(row, headerMap, 'occupation'),
      status: col(row, headerMap, 'status'),
      organization_names: col(row, headerMap, 'organization_names'),
      organization_ids: col(row, headerMap, 'organization_ids'),
      image_url: col(row, headerMap, 'image_url'),
      profile: col(row, headerMap, 'profile'),
      personality: col(row, headerMap, 'personality'),
      memo: col(row, headerMap, 'memo'),
      edit_url: col(row, headerMap, 'edit_url')
    };

    // 列を追加したらここにも追記（例）
  // npc.person = col(row, headerMap, 'person');
  // npc.episodes = col(row, headerMap, 'episodes');
  // npc.contactable_pc_ids = col(row, headerMap, 'contactable_pc_ids');
  // npc.scenario_ids = col(row, headerMap, 'scenario_ids');
  // npc.related_npc_ids = col(row, headerMap, 'related_npc_ids');
  // npc.location_ids = col(row, headerMap, 'location_ids');

    npcs.push(npc);
  }
  return npcs;
}
```

## getNpcData の例（日本語列名・将来用）

```javascript
function col(row, headerMap, ...keys) {
  for (const key of keys) {
    const idx = headerMap[key];
    if (idx !== undefined && row[idx] !== '' && row[idx] != null) {
      return row[idx];
    }
  }
  return '';
}

function getNpcData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NPC');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const headerMap = {};
  headers.forEach((h, i) => { headerMap[h] = i; });

  const npcs = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!col(row, headerMap, 'id', 'ID')) continue;

    npcs.push({
      id: col(row, headerMap, 'id', 'ID'),
      name: col(row, headerMap, '名前', 'name'),
      furigana: col(row, headerMap, 'フリガナ', 'furigana'),
      birth_date: col(row, headerMap, '生年月日', 'birth_date'),
      age: col(row, headerMap, '年齢', 'age'),
      nationality: col(row, headerMap, '国籍', 'nationality'),
      birth_place: col(row, headerMap, '出身地', 'birth_place'),
      occupation: col(row, headerMap, '職業', 'occupation'),
      status: col(row, headerMap, '状態', 'status'),
      organization_ids: col(row, headerMap, 'organization_id', 'organization_ids'),
      organization_names: col(row, headerMap, 'organization_names', '所属組織名'),
      image_url: col(row, headerMap, '画像URL', 'image_url'),
      profile: col(row, headerMap, '人物紹介', 'profile'),
      person: col(row, headerMap, '人物', 'person'),
      personality: col(row, headerMap, '性格', 'personality'),
      family: col(row, headerMap, '家族', 'family'),
      pet: col(row, headerMap, 'ペット', 'pet'),
      traits: col(row, headerMap, '特徴', 'traits'),
      episodes: col(row, headerMap, 'エピソード', 'episodes'),
      contactable_pc_ids: col(row, headerMap, '連絡可能PC', 'contactable_pc_ids'),
      scenario_ids: col(row, headerMap, '登場シナリオ', 'scenario_ids'),
      related_npc_ids: col(row, headerMap, '関連NPC', 'related_npc_ids'),
      location_ids: col(row, headerMap, '関連場所', 'location_ids')
    });
  }
  return npcs;
}
```

## doGet との組み合わせ

`callback` 対応は [gas-doget.md](./gas-doget.md) を参照。

```javascript
function doGet(e) {
  const type = e.parameter.type;
  let data = [];
  if (type === 'npcs') data = getNpcData();

  const json = JSON.stringify(data);
  const callback = e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
```

## デプロイ後の確認

ブラウザまたは curl で API を開き、各 NPC に `person` / `episodes` などが含まれるか確認します。

```
https://script.google.com/macros/s/＜デプロイID＞/exec?type=npcs
```

H.P.ラヴクラフトの例で `person` や `episodes` が JSON に無ければ、サイト側でも表示されません（サイトの表示ロジックは実装済みです）。
