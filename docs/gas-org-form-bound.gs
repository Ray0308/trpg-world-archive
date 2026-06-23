/**
 * YOKOFOLIA — 組織PJ 専用（組織入力フォームに紐づける）
 *
 * プロジェクト名の対応:
 *   DBPJ   … スプレッドシート（TRPG World Archive DB）
 *   NPCPJ  … NPC用フォーム + API（docs/gas-npc-form.gs）
 *   組織PJ … このファイル（組織フォーム送信 → ORGANIZATIONS 転記）
 *
 * 組織フォームを送信すると **組織PJ** のスクリプトが動く（NPCPJ は動かない）。
 * サイト API（?type=organizations）は NPCPJ のデプロイのまま。
 *
 * セットアップ:
 * 1. 組織入力フォーム → ⋮ → スクリプトエディタ（組織PJ）
 * 2. この内容を Code.gs に貼り付けて保存
 * 3. トリガー追加 → onOrganizationFormSubmit / フォームから / 送信時
 * 4. importAllOrgResponses を ▶ 実行（溜まった回答の一括取り込み・任意）
 *
 * デプロイ（ウェブアプリ）は不要。
 */

function getAnswers_(response) {
  const answers = {};
  response.getItemResponses().forEach(itemResponse => {
    const title = normalizeTitle_(itemResponse.getItem().getTitle());
    answers[title] = itemResponse.getResponse();
  });
  return answers;
}

function normalizeTitle_(title) {
  return String(title)
    .replace(/^[0-9０-９]+[.．、\s]*/, '')
    .trim();
}

function normalizeSheetHeader_(title) {
  const t = normalizeTitle_(title);
  return t === 'タイムスタンプ' ? '' : t;
}

function pickAnswer_(answers, ...keys) {
  for (const key of keys) {
    if (answers[key] != null && String(answers[key]).trim() !== '') {
      return answers[key];
    }
  }
  return '';
}

function readSheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

function getOrgHeaders_() {
  return [
    'id',
    'name',
    'icon',
    'summary',
    'description',
    'location_id',
    'location_name',
    'scenario_ids',
    'memo',
    'pl_hidden',
    'edit_url',
    'form_response_id',
    'created_at',
    'updated_at'
  ];
}

function ensureOrgHeader_(sheet) {
  const headers = getOrgHeaders_();
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

function generateOrgId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'org_001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNumber = 0;
  ids.forEach(id => {
    const match = String(id).match(/^org_(\d+)$/);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });
  return 'org_' + String(maxNumber + 1).padStart(3, '0');
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
  throw new Error('DBPJ を取得できません（組織PJ＝組織フォームに紐づけてください）');
}

function getSpreadsheetFromEvent_(e) {
  const form = getFormFromEvent_(e);
  return SpreadsheetApp.openById(form.getDestinationId());
}

function findOrgResponseSheet_(ss) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const width = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, width).getValues()[0]
      .map(h => normalizeSheetHeader_(h))
      .filter(Boolean);
    if (headers.indexOf('組織名') >= 0) return sheet;
  }
  return null;
}

function answersFromResponseSheetRow_(responseSheet, rowIndex) {
  const width = Math.max(responseSheet.getLastColumn(), 1);
  const headers = responseSheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => normalizeSheetHeader_(h));
  const values = responseSheet.getRange(rowIndex, 1, 1, width).getValues()[0];
  const answers = {};
  headers.forEach((header, index) => {
    if (header) answers[header] = values[index];
  });
  return answers;
}

function isOrgResponseAlreadyImported_(orgSheet, formResponseId) {
  if (!formResponseId) return false;
  const headers = readSheetHeaders_(orgSheet);
  const idx = headers.indexOf('form_response_id');
  if (idx < 0) return false;
  const lastRow = orgSheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = orgSheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().flat();
  return values.some(v => String(v).trim() === String(formResponseId).trim());
}

function isOrgNameAlreadyImported_(orgSheet, name) {
  const n = String(name || '').trim();
  if (!n) return false;
  const headers = readSheetHeaders_(orgSheet);
  const idx = headers.indexOf('name');
  if (idx < 0) return false;
  const lastRow = orgSheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = orgSheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().flat();
  return values.some(v => String(v).trim() === n);
}

function buildOrgRowFromAnswers_(answers, sheet, meta) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;
  return {
    id: generateOrgId_(sheet),
    name: pickAnswer_(answers, '組織名'),
    icon: pickAnswer_(answers, 'アイコン') || '🏛️',
    summary: pickAnswer_(answers, '概要'),
    description: pickAnswer_(answers, '説明'),
    location_id: '',
    location_name: pickAnswer_(answers, '所在地'),
    scenario_ids: pickAnswer_(answers, '関連シナリオ'),
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

function appendOrganizationFromAnswers_(ss, answers, meta) {
  const orgSheet = getOrCreateSheet_(ss, 'ORGANIZATIONS');
  const headers = ensureOrgHeader_(orgSheet);
  const rowData = buildOrgRowFromAnswers_(answers, orgSheet, meta);

  if (!String(rowData.name || '').trim()) {
    Logger.log('ORG skip: 組織名が空');
    return null;
  }
  if (rowData.form_response_id &&
      isOrgResponseAlreadyImported_(orgSheet, rowData.form_response_id)) {
    Logger.log('ORG skip duplicate: ' + rowData.form_response_id);
    return null;
  }

  const row = headers.map(header => rowData[header] ?? '');
  orgSheet.appendRow(row);
  Logger.log('ORG imported: ' + rowData.id + ' / ' + rowData.name);
  return rowData.id;
}

/**
 * 組織PJ トリガー: フォームから → フォーム送信時
 */
function onOrganizationFormSubmit(e) {
  try {
    const ss = getSpreadsheetFromEvent_(e);
    const response = e.response;
    const answers = getAnswers_(response);
    appendOrganizationFromAnswers_(ss, answers, { response: response });
  } catch (err) {
    Logger.log('onOrganizationFormSubmit ERROR: ' + (err.message || err));
    throw err;
  }
}

/** 診断（▶ 実行）。結果は実行ログに出ます。 */
function checkOrgSetup() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = '組織PJ（組織フォームのスクリプトエディタ）から実行してください';
    Logger.log(msg);
    return msg;
  }
  const spreadsheet = SpreadsheetApp.openById(form.getDestinationId());
  const responseSheet = findOrgResponseSheet_(spreadsheet);
  const orgSheet = spreadsheet.getSheetByName('ORGANIZATIONS');
  const msg = [
    'DBPJ: ' + spreadsheet.getName(),
    '組織の回答シート: ' + (responseSheet
      ? responseSheet.getName() + '（' + Math.max(0, responseSheet.getLastRow() - 1) + '件）'
      : '見つかりません'),
    'ORGANIZATIONS: ' + (orgSheet ? Math.max(0, orgSheet.getLastRow() - 1) + '件' : 'まだ無い')
  ].join('\n');
  Logger.log(msg);
  return msg;
}

/** 回答シートの未取り込み行を一括取り込み */
function importAllOrgResponses() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = '組織PJ（組織フォームのスクリプトエディタ）から実行してください';
    Logger.log(msg);
    return msg;
  }
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const responseSheet = findOrgResponseSheet_(ss);
  if (!responseSheet) {
    const msg = '組織の回答シートが見つかりません';
    Logger.log(msg);
    return msg;
  }

  const orgSheet = getOrCreateSheet_(ss, 'ORGANIZATIONS');
  const lastRow = responseSheet.getLastRow();
  let imported = 0;
  let skipped = 0;

  for (let row = 2; row <= lastRow; row++) {
    const answers = answersFromResponseSheetRow_(responseSheet, row);
    const name = pickAnswer_(answers, '組織名');
    if (!name || isOrgNameAlreadyImported_(orgSheet, name)) {
      skipped++;
      continue;
    }
    const id = appendOrganizationFromAnswers_(ss, answers, {});
    if (id) imported++;
    else skipped++;
  }

  const msg = '一括取り込み: ' + imported + ' 件追加 / ' + skipped + ' 件スキップ';
  Logger.log(msg);
  return msg;
}
