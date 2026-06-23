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
    const raw = itemResponse.getResponse();
    if (Array.isArray(raw) && title === 'アイコン') {
      answers[title] = raw;
    } else {
      answers[title] = normalizeAnswerValue_(raw);
    }
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

function toDriveFileUrl_(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    const fileId = value[0];
    return fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : '';
  }
  const text = String(value).trim();
  if (!text || /^\[Ljava\.lang\.Object;@/i.test(text)) return '';
  if (text.startsWith('http')) {
    const m = text.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    return text;
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) {
    return `https://drive.google.com/uc?export=view&id=${text}`;
  }
  return '';
}

function normalizeOrgIcon_(raw) {
  if (raw == null || raw === '') return '🏛️';
  const driveUrl = toDriveFileUrl_(raw);
  if (driveUrl) return driveUrl;
  const s = normalizeAnswerValue_(raw);
  if (!s) return '🏛️';
  if (/^\[Ljava\.lang\.Object;@/i.test(s)) return '🏛️';
  if (/^https?:\/\//i.test(s)) return toDriveFileUrl_(s) || s;
  if (s.length <= 8) return s;
  return '🏛️';
}

function readSheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

function splitList_(value) {
  if (!value) return [];
  return String(value)
    .split(/[,、|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function npcNameMatches_(part, npcName) {
  const p = String(part || '').trim();
  const name = String(npcName || '').trim();
  if (!p || !name) return false;
  return name === p || p.indexOf(name) >= 0 || name.indexOf(p) >= 0;
}

/**
 * 所属NPC（名前）から NPCS シートを引いて ID を解決
 */
function resolveNpcIdsFromNames_(ss, namesText) {
  const parts = splitList_(namesText);
  if (!parts.length) return '';

  const sheet = ss.getSheetByName('NPCS');
  if (!sheet || sheet.getLastRow() <= 1) return '';

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.indexOf('name');
  if (idIdx < 0 || nameIdx < 0) return '';

  const npcs = values.slice(1)
    .filter(row => row[idIdx])
    .map(row => ({
      id: String(row[idIdx]).trim(),
      name: String(row[nameIdx] || '').trim()
    }));

  const matched = [];
  const seen = new Set();
  parts.forEach(part => {
    npcs.forEach(npc => {
      if (npcNameMatches_(part, npc.name) && !seen.has(npc.id)) {
        seen.add(npc.id);
        matched.push(npc.id);
      }
    });
  });
  return matched.join(', ');
}

function mergeCsvIds_(current, addIds) {
  const set = new Set(splitList_(current));
  (addIds || []).forEach(id => {
    const t = String(id || '').trim();
    if (t) set.add(t);
  });
  return [...set].join(', ');
}

function mergeCsvNames_(current, addNames) {
  const parts = splitList_(current);
  const seen = new Set(parts.map(p => p.toLowerCase()));
  (addNames || []).forEach(name => {
    const t = String(name || '').trim();
    if (t && !seen.has(t.toLowerCase())) {
      parts.push(t);
      seen.add(t.toLowerCase());
    }
  });
  return parts.join(', ');
}

function readNpcSheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

/**
 * 組織登録時: ORGANIZATIONS の所属NPC → NPCS の organization_ids / organization_names を更新
 */
function linkNpcsToOrganization_(ss, orgId, orgName, memberNpcNamesText, memberNpcIdsText) {
  const npcIds = splitList_(memberNpcIdsText);
  if (!npcIds.length) {
    if (memberNpcNamesText) {
      Logger.log('ORG link warn: NPC名に一致なし — 「' + memberNpcNamesText + '」');
    }
    return 0;
  }

  const npcSheet = ss.getSheetByName('NPCS');
  if (!npcSheet || npcSheet.getLastRow() <= 1) {
    Logger.log('ORG link skip: NPCS が空');
    return 0;
  }

  const headers = readNpcSheetHeaders_(npcSheet);
  const idIdx = headers.indexOf('id');
  const orgIdsIdx = headers.indexOf('organization_ids');
  const orgNamesIdx = headers.indexOf('organization_names');
  if (idIdx < 0 || orgIdsIdx < 0) return 0;

  const targetIds = new Set(npcIds);
  let updated = 0;
  const lastRow = npcSheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    const npcId = String(npcSheet.getRange(row, idIdx + 1).getValue() || '').trim();
    if (!targetIds.has(npcId)) continue;

    const curIds = String(npcSheet.getRange(row, orgIdsIdx + 1).getValue() || '').trim();
    const newIds = mergeCsvIds_(curIds, [orgId]);
    if (newIds !== curIds) {
      npcSheet.getRange(row, orgIdsIdx + 1).setValue(newIds);
      updated++;
    }

    if (orgNamesIdx >= 0 && orgName) {
      const curNames = String(npcSheet.getRange(row, orgNamesIdx + 1).getValue() || '').trim();
      const newNames = mergeCsvNames_(curNames, [orgName]);
      if (newNames !== curNames) {
        npcSheet.getRange(row, orgNamesIdx + 1).setValue(newNames);
      }
    }
  }

  Logger.log('ORG link NPCs: ' + updated + ' 行更新 (' + orgId + ')');
  return updated;
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
    'member_npc_names',
    'member_npc_ids',
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

function buildOrgRowFromAnswers_(answers, sheet, meta, ss) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;
  const memberNpcNames = pickAnswer_(answers, '所属NPC');
  const memberNpcIds = ss ? resolveNpcIdsFromNames_(ss, memberNpcNames) : '';
  return {
    id: generateOrgId_(sheet),
    name: pickAnswer_(answers, '組織名'),
    icon: normalizeOrgIcon_(answers['アイコン'] != null ? answers['アイコン'] : pickAnswer_(answers, 'アイコン')),
    summary: pickAnswer_(answers, '概要'),
    description: pickAnswer_(answers, '説明'),
    location_id: '',
    location_name: pickAnswer_(answers, '所在地'),
    scenario_ids: pickAnswer_(answers, '関連シナリオ'),
    member_npc_names: memberNpcNames,
    member_npc_ids: memberNpcIds,
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
  const rowData = buildOrgRowFromAnswers_(answers, orgSheet, meta, ss);

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
  linkNpcsToOrganization_(
    ss,
    rowData.id,
    rowData.name,
    rowData.member_npc_names,
    rowData.member_npc_ids
  );
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

/**
 * ORGANIZATIONS シートの壊れた値を修正（▶ で1回実行）
 * [Ljava.lang.Object;@... が name/icon に入っている行を直す
 */
function fixOrgSheetGarbageValues() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = '組織PJ から実行してください';
    Logger.log(msg);
    return msg;
  }
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const sheet = ss.getSheetByName('ORGANIZATIONS');
  if (!sheet || sheet.getLastRow() <= 1) {
    const msg = 'ORGANIZATIONS が空です';
    Logger.log(msg);
    return msg;
  }

  const headers = readSheetHeaders_(sheet);
  const nameIdx = headers.indexOf('name');
  const iconIdx = headers.indexOf('icon');
  let fixed = 0;

  for (let row = 2; row <= sheet.getLastRow(); row++) {
    let changed = false;
    if (nameIdx >= 0) {
      const cell = sheet.getRange(row, nameIdx + 1);
      const cleaned = normalizeAnswerValue_(cell.getValue())
        .replace(/\[Ljava\.lang\.Object;@[a-f0-9]+\s*/gi, '')
        .replace(/Object;@[a-f0-9]+\s*/gi, '')
        .trim();
      if (cleaned !== String(cell.getValue() || '').trim()) {
        cell.setValue(cleaned);
        changed = true;
      }
    }
    if (iconIdx >= 0) {
      const cell = sheet.getRange(row, iconIdx + 1);
      const cleaned = normalizeOrgIcon_(cell.getValue());
      if (cleaned !== String(cell.getValue() || '').trim()) {
        cell.setValue(cleaned);
        changed = true;
      }
    }
    if (changed) fixed++;
  }

  const msg = '修正完了: ' + fixed + ' 行';
  Logger.log(msg);
  return msg;
}

/**
 * 全組織行の所属NPCを NPCS に再反映（▶ で1回実行・列追加後の修復用）
 */
function syncAllOrgMemberNpcLinks() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = '組織PJ から実行してください';
    Logger.log(msg);
    return msg;
  }
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const orgSheet = ss.getSheetByName('ORGANIZATIONS');
  if (!orgSheet || orgSheet.getLastRow() <= 1) {
    const msg = 'ORGANIZATIONS が空です';
    Logger.log(msg);
    return msg;
  }

  ensureOrgHeader_(orgSheet);
  const headers = readSheetHeaders_(orgSheet);
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.indexOf('name');
  const memberNamesIdx = headers.indexOf('member_npc_names');
  const memberIdsIdx = headers.indexOf('member_npc_ids');
  if (idIdx < 0 || nameIdx < 0) {
    const msg = 'id / name 列が見つかりません';
    Logger.log(msg);
    return msg;
  }

  let linked = 0;
  let resolved = 0;
  for (let row = 2; row <= orgSheet.getLastRow(); row++) {
    const orgId = String(orgSheet.getRange(row, idIdx + 1).getValue() || '').trim();
    const orgName = String(orgSheet.getRange(row, nameIdx + 1).getValue() || '').trim();
    if (!orgId || !orgName) continue;

    let memberNames = memberNamesIdx >= 0
      ? String(orgSheet.getRange(row, memberNamesIdx + 1).getValue() || '').trim()
      : '';
    let memberIds = memberIdsIdx >= 0
      ? String(orgSheet.getRange(row, memberIdsIdx + 1).getValue() || '').trim()
      : '';

    if (memberNames && !memberIds) {
      memberIds = resolveNpcIdsFromNames_(ss, memberNames);
      if (memberIds && memberIdsIdx >= 0) {
        orgSheet.getRange(row, memberIdsIdx + 1).setValue(memberIds);
        resolved++;
      }
    }

    if (memberIds) {
      linked += linkNpcsToOrganization_(ss, orgId, orgName, memberNames, memberIds);
    }
  }

  const msg = '所属NPCリンク完了: NPC ' + linked + ' 行更新 / ID解決 ' + resolved + ' 組織';
  Logger.log(msg);
  return msg;
}
