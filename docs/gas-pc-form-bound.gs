/**
 * YOKOFOLIA — PC PJ 専用（PL向け PC 入力フォームに紐づける）
 *
 *   DBPJ   … スプレッドシート（TRPG World Archive DB）
 *   NPCPJ  … docs/gas-npc-form.gs（公開 API）
 *   PC PJ  … このファイル（フォーム送信 → PCS 転記）
 *
 * PL が PC名・プレイヤー名・キャラシURL を登録します。
 * 関連シナリオ / 連絡可能NPC はシナリオ・NPC フォームから名前で自動紐づけ。
 *
 * セットアップ:
 * 1. PC 入力フォーム → ⋮ → スクリプトエディタ（PC PJ）
 * 2. この内容を Code.gs に貼り付けて保存
 * 3. トリガー → onPcFormSubmit / フォームから / 送信時
 * 4. importAllPcResponses を ▶ 実行（任意）
 *
 * デプロイ不要。API は NPCPJ を再デプロイ（?type=pcs）。
 */

function getAnswers_(response) {
  const answers = {};
  response.getItemResponses().forEach(itemResponse => {
    const title = normalizeTitle_(itemResponse.getItem().getTitle());
    answers[title] = normalizeAnswerValue_(itemResponse.getResponse());
  });
  return answers;
}

function normalizeTitle_(title) {
  return String(title)
    .replace(/^[0-9０-９]+[.．、\s]*/, '')
    .trim();
}

function normalizeAnswerValue_(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    return value.map(v => normalizeAnswerValue_(v)).filter(Boolean).join(', ');
  }
  const s = String(value).trim();
  if (/^\[Ljava\.lang\.Object;@/i.test(s)) return '';
  return s;
}

function pickAnswer_(answers, ...keys) {
  for (const key of keys) {
    const text = normalizeAnswerValue_(answers[key]);
    if (text) return text;
  }
  return '';
}

function readSheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

function getOrCreateSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet || ss.insertSheet(sheetName);
}

function getFormFromEvent_(e) {
  if (e && e.source && typeof e.source.getDestinationId === 'function') {
    return e.source;
  }
  if (e && e.response && typeof e.response.getSource === 'function') {
    return e.response.getSource();
  }
  const form = FormApp.getActiveForm();
  if (form) return form;
  throw new Error('DBPJ を取得できません（PC PJ＝PC フォームに紐づけてください）');
}

function getSpreadsheetFromEvent_(e) {
  const form = getFormFromEvent_(e);
  return SpreadsheetApp.openById(form.getDestinationId());
}

function getPcHeaders_() {
  return [
    'id',
    'name',
    'player_name',
    'sheet_url',
    'memo',
    'pl_hidden',
    'edit_url',
    'form_response_id',
    'created_at',
    'updated_at'
  ];
}

function ensurePcHeader_(sheet) {
  const headers = getPcHeaders_();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const isEmpty = firstRow.every(value => value === '');

  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return headers;
  }

  const present = new Set(
    firstRow.map(h => String(h).trim()).filter(Boolean)
  );

  headers.forEach(name => {
    if (!present.has(name)) {
      const col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(name);
      present.add(name);
    }
  });

  return readSheetHeaders_(sheet);
}

function generatePcId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'pc_001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNumber = 0;
  ids.forEach(id => {
    const match = String(id).match(/^pc_(\d+)$/i);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });
  return 'pc_' + String(maxNumber + 1).padStart(3, '0');
}

function normalizeSheetUrl_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

function isPcResponseAlreadyImported_(sheet, formResponseId) {
  const headers = readSheetHeaders_(sheet);
  const idx = headers.indexOf('form_response_id');
  if (idx < 0) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().flat();
  return values.some(v => String(v).trim() === String(formResponseId).trim());
}

function buildPcRowFromAnswers_(answers, sheet, meta) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;

  return {
    id: generatePcId_(sheet),
    name: pickAnswer_(answers, 'PC名'),
    player_name: pickAnswer_(answers, 'プレイヤー名'),
    sheet_url: normalizeSheetUrl_(pickAnswer_(answers, 'キャラシURL')),
    memo: pickAnswer_(answers, '備考'),
    pl_hidden: '',
    edit_url: m.editUrl || (response && typeof response.getEditResponseUrl === 'function'
      ? response.getEditResponseUrl() : ''),
    form_response_id: m.formResponseId || (response && typeof response.getId === 'function'
      ? response.getId() : ''),
    created_at: now,
    updated_at: now
  };
}

function appendPcFromAnswers_(ss, answers, meta) {
  const pcSheet = getOrCreateSheet_(ss, 'PCS');
  const headers = ensurePcHeader_(pcSheet);
  const rowData = buildPcRowFromAnswers_(answers, pcSheet, meta);

  if (!String(rowData.name || '').trim()) {
    Logger.log('PC skip: PC名が空');
    return null;
  }
  if (!String(rowData.player_name || '').trim()) {
    Logger.log('PC skip: プレイヤー名が空');
    return null;
  }
  if (rowData.form_response_id &&
      isPcResponseAlreadyImported_(pcSheet, rowData.form_response_id)) {
    Logger.log('PC skip duplicate: ' + rowData.form_response_id);
    return null;
  }

  const row = headers.map(header => rowData[header] ?? '');
  pcSheet.appendRow(row);
  Logger.log('PC imported: ' + rowData.id + ' / ' + rowData.name);
  return rowData.id;
}

function onPcFormSubmit(e) {
  try {
    const ss = getSpreadsheetFromEvent_(e);
    const response = e.response;
    const answers = getAnswers_(response);
    appendPcFromAnswers_(ss, answers, { response: response });
  } catch (err) {
    Logger.log('onPcFormSubmit ERROR: ' + (err.message || err));
    throw err;
  }
}

function checkPcSetup() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = 'PC PJ（PC フォームのスクリプトエディタ）から実行してください';
    Logger.log(msg);
    return msg;
  }
  const spreadsheet = SpreadsheetApp.openById(form.getDestinationId());
  const pcSheet = spreadsheet.getSheetByName('PCS');
  const msg = [
    'DBPJ: ' + spreadsheet.getName(),
    'PCS: ' + (pcSheet ? Math.max(0, pcSheet.getLastRow() - 1) + '件' : 'まだ無い')
  ].join('\n');
  Logger.log(msg);
  return msg;
}

function importAllPcResponses() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = 'PC PJ から実行してください';
    Logger.log(msg);
    return msg;
  }
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const responses = form.getResponses();
  let imported = 0;
  responses.forEach(response => {
    const answers = getAnswers_(response);
    const id = appendPcFromAnswers_(ss, answers, { response: response });
    if (id) imported++;
  });
  const msg = '取り込み完了: ' + imported + ' 件';
  Logger.log(msg);
  return msg;
}
