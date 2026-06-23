/**
 * YOKOFOLIA — 組織フォーム → ORGANIZATIONS（スプレッドシート紐づけ・推奨）
 *
 * フォーム側 GAS より確実です。
 *
 * セットアップ:
 * 1. 「TRPG World Archive DB」スプレッドシートを開く
 * 2. 拡張機能 → Apps Script
 * 3. この内容を Code.gs に貼り付けて保存
 * 4. 関数 checkOrgSetup を選んで ▶ 実行 → 権限を承認
 * 5. 関数 importLastOrgResponse を ▶ 実行（テスト用・最後の1件を取り込む）
 * 6. トリガー追加:
 *    - 関数: onSpreadsheetFormSubmit
 *    - ソース: スプレッドシートから
 *    - 種類: フォーム送信時
 *
 * API（?type=organizations）は NPC フォーム側 GAS のデプロイのまま。
 */

function normalizeTitle_(title) {
  return String(title)
    .replace(/^[0-9０-９]+[.．、\s]*/, '')
    .replace(/^タイムスタンプ$/, '')
    .trim();
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

function getArchiveSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  throw new Error('スプレッドシートを開いた状態で実行してください');
}

function isOrganizationFormTitle_(title) {
  return /組織/.test(String(title));
}

function findOrgResponseSheet_(ss) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const width = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, width).getValues()[0]
      .map(h => normalizeTitle_(h));
    if (headers.indexOf('組織名') >= 0) return sheet;
  }
  return null;
}

function answersFromResponseSheetRow_(responseSheet, rowIndex) {
  const width = Math.max(responseSheet.getLastColumn(), 1);
  const headers = responseSheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => normalizeTitle_(h));
  const values = responseSheet.getRange(rowIndex, 1, 1, width).getValues()[0];
  const answers = {};
  headers.forEach((header, index) => {
    if (header) answers[header] = values[index];
  });
  return answers;
}

function buildOrgRowFromAnswers_(answers, sheet, options) {
  const now = new Date();
  const opts = options || {};
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
    edit_url: opts.editUrl || '',
    form_response_id: opts.formResponseId || '',
    created_at: now,
    updated_at: now
  };
}

function appendOrgRow_(ss, answers, options) {
  const sheet = getOrCreateSheet_(ss, 'ORGANIZATIONS');
  const headers = ensureOrgHeader_(sheet);
  const rowData = buildOrgRowFromAnswers_(answers, sheet, options);
  const row = headers.map(header => rowData[header] ?? '');
  sheet.appendRow(row);
  return rowData.id;
}

function processOrganizationSubmit_(e) {
  if (!e || !e.response) return;

  const title = e.response.getSource().getTitle();
  if (!isOrganizationFormTitle_(title)) return;

  const ss = getArchiveSpreadsheet_();
  const response = e.response;
  const answers = {};
  response.getItemResponses().forEach(itemResponse => {
    const key = normalizeTitle_(itemResponse.getItem().getTitle());
    answers[key] = itemResponse.getResponse();
  });

  appendOrgRow_(ss, answers, {
    editUrl: response.getEditResponseUrl(),
    formResponseId: response.getId()
  });
}

/**
 * トリガー用: スプレッドシートから → フォーム送信時
 */
function onSpreadsheetFormSubmit(e) {
  processOrganizationSubmit_(e);
}

/**
 * 診断: スプレッドシートを開いた状態で ▶ 実行
 */
function checkOrgSetup() {
  const ss = getArchiveSpreadsheet_();
  const responseSheet = findOrgResponseSheet_(ss);
  const orgSheet = ss.getSheetByName('ORGANIZATIONS');
  const lines = [
    'スプレッドシート: ' + ss.getName(),
    '組織の回答シート: ' + (responseSheet ? responseSheet.getName() + '（' + Math.max(0, responseSheet.getLastRow() - 1) + '件）' : '見つかりません'),
    'ORGANIZATIONS: ' + (orgSheet ? orgSheet.getLastRow() - 1 + '件' : 'まだ無い')
  ];
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

/**
 * 応急: トリガーが動かないとき、回答シートの最後の1行を手動取り込み
 */
function importLastOrgResponse() {
  const ss = getArchiveSpreadsheet_();
  const responseSheet = findOrgResponseSheet_(ss);
  if (!responseSheet) {
    throw new Error('「組織名」列がある回答シートが見つかりません。組織フォームの回答先スプシを確認してください。');
  }
  const lastRow = responseSheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('組織フォームの回答がまだありません。先にフォームを1件送信してください。');
  }

  const answers = answersFromResponseSheetRow_(responseSheet, lastRow);
  const id = appendOrgRow_(ss, answers, {});
  SpreadsheetApp.getUi().alert('取り込みました: ' + id + '\n名前: ' + pickAnswer_(answers, '組織名'));
}
