/**
 * YOKOFOLIA — 組織フォーム専用（このフォームにだけ紐づける）
 *
 * NPC 用 GAS は NPC フォームに紐づいているため、
 * 組織フォームの送信トリガーは **組織フォーム側** に置く必要があります。
 *
 * セットアップ:
 * 1. 組織入力フォーム → ⋮ → スクリプトエディタ
 * 2. このファイルの内容を Code.gs に貼り付けて保存
 * 3. トリガー追加 → onOrganizationFormSubmit / フォームから / このフォーム / 送信時
 *
 * API（?type=organizations）は NPC フォーム側 GAS のデプロイのまま使います。
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

function getSpreadsheetFromEvent_(e) {
  if (e && e.response) {
    return SpreadsheetApp.openById(e.response.getSource().getDestinationId());
  }
  const form = FormApp.getActiveForm();
  if (form) return SpreadsheetApp.openById(form.getDestinationId());
  throw new Error('スプレッドシートを取得できません（組織フォームに紐づけて実行してください）');
}

function buildOrgRowFromAnswers_(answers, sheet, response) {
  const now = new Date();
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
    edit_url: response.getEditResponseUrl(),
    form_response_id: response.getId(),
    created_at: now,
    updated_at: now
  };
}

function onOrganizationFormSubmit(e) {
  const ss = getSpreadsheetFromEvent_(e);
  const sheet = getOrCreateSheet_(ss, 'ORGANIZATIONS');
  const headers = ensureOrgHeader_(sheet);

  const response = e.response;
  const answers = getAnswers_(response);
  const rowData = buildOrgRowFromAnswers_(answers, sheet, response);
  const row = headers.map(header => rowData[header] ?? '');
  sheet.appendRow(row);
}
