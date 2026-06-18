/**
 * Ver2 データプロバイダ — Googleスプレッドシート
 *
 * 想定フロー:
 *   Googleフォーム → スプレッドシート各シート → 本プロバイダ → 正規化 → UI
 *
 * 実装候補:
 *   - 公開 CSV / gviz API
 *   - Google Sheets API v4（要 API キー or OAuth）
 *   - Apps Script Web App（JSON エンドポイント）
 *
 * シート列定義は js/data/normalize.js の normalize*Row を参照
 */
window.SheetsDataProvider = {
  async load(config) {
    const { spreadsheetId, sheets } = config || {};

    if (!spreadsheetId) {
      throw new Error(
        'Googleスプレッドシート連携は未設定です。' +
        'js/config.js の AppConfig.sheets.spreadsheetId を設定するか、' +
        'AppConfig.dataProvider を "json" にしてください。'
      );
    }

    // Ver2: シート名ごとに取得し行配列を返す
    // const rows = await fetchSheet(spreadsheetId, sheets.npcs);
    // return { npcs: rows.map(ArchiveNormalize.normalizeNpcRow), ... };

    throw new Error('Googleスプレッドシート連携（Ver2）は未実装です');
  }
};
