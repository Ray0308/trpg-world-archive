/**
 * チャウグナー・ラン — スコアランキング API
 *
 * NPC 用 GAS に doGet の分岐を追記するか、このファイルを単体デプロイしてください。
 *
 * シート: CHAUGNER_SCORES
 * 列: name | score | created_at
 *
 * API:
 *   GET ?type=chaugner-ranking  → 上位3件（スコア降順、同点は created_at 昇順）
 *   GET ?type=chaugner-score&name=...&score=...  → スコア保存
 */

function getChaugnerHeaders_() {
  return ['name', 'score', 'created_at'];
}

function ensureChaugnerSheet_(ss) {
  const headers = getChaugnerHeaders_();
  let sheet = ss.getSheetByName('CHAUGNER_SCORES');
  if (!sheet) {
    sheet = ss.insertSheet('CHAUGNER_SCORES');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const isEmpty = firstRow.every(v => v === '');
  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function getChaugnerRanking_(ss) {
  const sheet = ensureChaugnerSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('name');
  const scoreCol = headers.indexOf('score');
  const dateCol = headers.indexOf('created_at');
  if (nameCol < 0 || scoreCol < 0 || dateCol < 0) return [];

  const rows = values.slice(1)
    .filter(row => row[nameCol] && row[scoreCol] !== '' && row[scoreCol] != null)
    .map(row => ({
      name: String(row[nameCol]).trim().slice(0, 12),
      score: Number(row[scoreCol]) || 0,
      created_at: row[dateCol] ? new Date(row[dateCol]).toISOString() : ''
    }))
    .filter(row => row.name && row.score >= 0);

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  return rows.slice(0, 3);
}

function saveChaugnerScore_(ss, name, score) {
  const sheet = ensureChaugnerSheet_(ss);
  const cleanName = String(name || '').trim().slice(0, 12);
  const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
  if (!cleanName) throw new Error('name is required');

  sheet.appendRow([cleanName, cleanScore, new Date()]);
  return { ok: true, name: cleanName, score: cleanScore };
}

/**
 * 既存 doGet に追記する場合の例:
 *
 * if (type === 'chaugner-ranking') {
 *   return jsonResponse_(getChaugnerRanking_(ss), callback);
 * }
 * if (type === 'chaugner-score') {
 *   const name = String((e.parameter && e.parameter.name) || '').trim();
 *   const score = e.parameter && e.parameter.score;
 *   try {
 *     return jsonResponse_(saveChaugnerScore_(ss, name, score), callback);
 *   } catch (err) {
 *     return jsonResponse_({ error: err.message || String(err) }, callback);
 *   }
 * }
 */
