# Apps Script doGet — callback 対応

ブラウザ（GitHub Pages）から NPC データを取得するには、**JSONP 用の callback パラメータ**に対応してください。

NPC の **全表示項目**（人物・エピソード・連絡可能PC・関連ID 等）を API に含める手順は [gas-npc-export.md](./gas-npc-export.md) を参照してください。

## doGet の例

```javascript
function doGet(e) {
  const type = e.parameter.type;
  let data = [];

  if (type === 'npcs') {
    data = getNpcData(); // スプレッドシートから取得する既存の関数
  }

  const json = JSON.stringify(data);
  const callback = e.parameter.callback;

  if (callback) {
    // JSONP（ブラウザからの取得用）
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // 通常の JSON 応答
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
```

## デプロイ設定

1. **デプロイ** → **新しいデプロイ**
2. 種類: **ウェブアプリ**
3. 実行ユーザー: **自分**
4. アクセスできるユーザー: **全員**

変更後は必ず **新しいバージョンで再デプロイ** してください。
