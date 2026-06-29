/**
 * YOKOFOLIA — PC PJ 専用（PL向け PC 入力フォームに紐づける）
 *
 *   DBPJ   … スプレッドシート（TRPG World Archive DB）
 *   NPCPJ  … docs/gas-npc-form.gs（公開 API）
 *   PC PJ  … このファイル（フォーム送信 → PCS 転記）
 *
 * PL が PC名・プレイヤー名・キャラシURL・画像（任意）を登録します。
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

function normalizeSheetHeader_(title) {
  const t = normalizeTitle_(title);
  return t === 'タイムスタンプ' ? '' : t;
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
    'image_url',
    'memo',
    'deleted',
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

function extractDriveFileId_(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return extractDriveFileId_(value[0]);
  const s = String(value).trim();
  if (!s || /^\[Ljava\.lang\.Object;@/i.test(s)) return '';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  const m = s.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function publishDriveFile_(value) {
  const fileId = extractDriveFileId_(value);
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId)
      .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Drive publish skip: ' + fileId + ' / ' + (e.message || e));
  }
}

function normalizeImageUrl_(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    const fileId = extractDriveFileId_(value[0]);
    if (!fileId) return '';
    publishDriveFile_(fileId);
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  const s = String(value).trim();
  if (!s) return '';
  const fileId = extractDriveFileId_(s);
  if (fileId) {
    publishDriveFile_(fileId);
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
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

function isPcAlreadyImportedByName_(sheet, name, playerName) {
  const n = String(name || '').trim();
  const p = String(playerName || '').trim();
  if (!n || !p) return false;

  const headers = readSheetHeaders_(sheet);
  const nameIdx = headers.indexOf('name');
  const playerIdx = headers.indexOf('player_name');
  if (nameIdx < 0 || playerIdx < 0) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows.some(row =>
    String(row[nameIdx] || '').trim() === n &&
    String(row[playerIdx] || '').trim() === p
  );
}

function buildPcRowFromAnswers_(answers, sheet, meta) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;

  return {
    id: generatePcId_(sheet),
    name: pickAnswer_(answers, 'PC名', 'PC名（キャラクター名）'),
    player_name: pickAnswer_(answers, 'プレイヤー名', 'プレイヤー名（あなたの名前・ハンドルネーム）'),
    sheet_url: normalizeSheetUrl_(pickAnswer_(answers, 'キャラシURL', 'キャラシURL（いあキャラの共有）')),
    image_url: normalizeImageUrl_(pickAnswer_(answers, '画像', 'PC画像', '立ち絵', '画像URL')),
    memo: pickAnswer_(answers, '備考'),
    pl_hidden: '',
    deleted: '',
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
  if (isPcAlreadyImportedByName_(pcSheet, rowData.name, rowData.player_name)) {
    Logger.log('PC skip duplicate name: ' + rowData.name);
    return null;
  }

  const row = headers.map(header => rowData[header] ?? '');
  pcSheet.appendRow(row);
  Logger.log('PC imported: ' + rowData.id + ' / ' + rowData.name);
  return rowData.id;
}

function onPcFormSubmit(e) {
  try {
    if (!e || !e.response) {
      Logger.log('onPcFormSubmit skip: e.response なし');
      return;
    }
    const ss = getSpreadsheetFromEvent_(e);
    const response = e.response;
    const answers = getAnswers_(response);
    Logger.log('onPcFormSubmit answers: ' + JSON.stringify(answers));
    appendPcFromAnswers_(ss, answers, { response: response });
  } catch (err) {
    Logger.log('onPcFormSubmit ERROR: ' + (err.message || err));
    throw err;
  }
}

function findPcResponseSheet_(ss) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const width = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, width).getValues()[0]
      .map(h => normalizeTitle_(String(h).trim()))
      .filter(Boolean);
    if (headers.some(h => h === 'PC名' || h.indexOf('PC名') === 0)) {
      return sheet;
    }
  }
  return null;
}

function answersFromResponseSheetRow_(responseSheet, rowIndex) {
  const width = Math.max(responseSheet.getLastColumn(), 1);
  const headers = responseSheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => normalizeTitle_(String(h).trim()));
  const values = responseSheet.getRange(rowIndex, 1, 1, width).getValues()[0];
  const answers = {};
  headers.forEach((header, index) => {
    if (header) answers[header] = values[index];
  });
  return answers;
}

/**
 * トリガーが動いていないときの救済 — 「フォームの回答」シートから PCS へ転記
 * PC PJ のスクリプトエディタから ▶ 実行
 */
function importFromPcResponseSheet() {
  const form = FormApp.getActiveForm();
  const ss = form
    ? SpreadsheetApp.openById(form.getDestinationId())
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const msg = 'スプレッドシートを取得できません';
    Logger.log(msg);
    return msg;
  }

  const responseSheet = findPcResponseSheet_(ss);
  if (!responseSheet) {
    const msg = 'PC の回答シートが見つかりません（質問に「PC名」があるシートを探します）';
    Logger.log(msg);
    return msg;
  }

  let imported = 0;
  let skipped = 0;
  const lastRow = responseSheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const answers = answersFromResponseSheetRow_(responseSheet, row);
    const id = appendPcFromAnswers_(ss, answers, {
      formResponseId: 'sheet-row-' + responseSheet.getName() + '-' + row
    });
    if (id) imported++;
    else skipped++;
  }

  const msg = '回答シートから転記: ' + imported + ' 件 / スキップ ' + skipped +
    '（' + responseSheet.getName() + '）';
  Logger.log(msg);
  return msg;
}

/**
 * フォーム送信トリガーを自動設定（PC PJ から ▶ 実行）
 */
function setupPcFormTrigger() {
  const form = FormApp.getActiveForm();
  if (!form) {
    throw new Error('PC入力フォーム → スクリプトエディタ（PC PJ）から実行してください');
  }

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onPcFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onPcFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  const msg = 'トリガー設定完了: onPcFormSubmit（フォーム送信時）';
  Logger.log(msg);
  return msg;
}

function diagnosePcForm() {
  const form = FormApp.getActiveForm();
  const lines = [];

  if (!form) {
    lines.push('NG: PCフォームのスクリプトエディタから実行してください');
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }

  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onPcFormSubmit');
  const responseSheet = findPcResponseSheet_(ss);
  const pcSheet = ss.getSheetByName('PCS');
  const responses = form.getResponses();

  lines.push('フォーム: ' + form.getTitle());
  lines.push('DBPJ: ' + ss.getName());
  lines.push('onPcFormSubmit トリガー: ' + triggers.length + ' 件' +
    (triggers.length ? '' : ' ← 0 なら setupPcFormTrigger を実行'));
  lines.push('回答シート: ' + (responseSheet
    ? responseSheet.getName() + '（' + Math.max(0, responseSheet.getLastRow() - 1) + '件）'
    : '見つかりません'));
  lines.push('PCS: ' + (pcSheet
    ? Math.max(0, pcSheet.getLastRow() - 1) + ' 件'
    : 'まだ無い'));
  lines.push('FormApp.getResponses(): ' + responses.length + ' 件');

  if (responses.length) {
    const answers = getAnswers_(responses[responses.length - 1]);
    lines.push('直近の回答キー: ' + Object.keys(answers).join(' / '));
    lines.push('直近の回答: ' + JSON.stringify(answers));
  }

  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}

function checkPcSetup() {
  return diagnosePcForm();
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
  let skipped = 0;
  responses.forEach(response => {
    const answers = getAnswers_(response);
    const id = appendPcFromAnswers_(ss, answers, { response: response });
    if (id) imported++;
    else skipped++;
  });
  const msg = 'FormApp から取り込み: ' + imported + ' 件 / スキップ ' + skipped;
  Logger.log(msg);
  return msg;
}

/**
 * 既存 PCS の画像をリンク閲覧可にし、URL を表示用に正規化
 * PC PJ のスクリプトエディタから ▶ 実行（1回）
 */
function publishAllPcDriveImages() {
  const form = FormApp.getActiveForm();
  const ss = form
    ? SpreadsheetApp.openById(form.getDestinationId())
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return 'スプレッドシートを取得できません';

  const sheet = ss.getSheetByName('PCS');
  if (!sheet) return 'PCS シートがありません';

  const headers = ensurePcHeader_(sheet);
  const imgIdx = headers.indexOf('image_url');
  if (imgIdx < 0) return 'image_url 列がありません';

  let updated = 0;
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const cell = sheet.getRange(row, imgIdx + 1);
    const normalized = normalizeImageUrl_(cell.getValue());
    if (normalized && normalized !== String(cell.getValue() || '').trim()) {
      cell.setValue(normalized);
      updated++;
    } else if (normalized) {
      updated++;
    }
  }
  const msg = 'PC画像を公開設定: ' + updated + ' 件';
  Logger.log(msg);
  return msg;
}
