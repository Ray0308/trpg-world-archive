/**
 * YOKOFOLIA — フォーム → スプレッドシート → 公開 API
 *
 * NPC:  トリガー onNpcFormSubmit（NPC登録フォーム）
 * 組織: トリガー onOrganizationFormSubmit（組織登録フォーム）
 * 両フォームの回答先は **同じスプレッドシート** にすること
 */

function getAnswers_(response) {
  const answers = {};
  response.getItemResponses().forEach(itemResponse => {
    let title = normalizeTitle_(itemResponse.getItem().getTitle());
    answers[title] = itemResponse.getResponse();
  });
  return answers;
}

function normalizeTitle_(title) {
  return String(title)
    .replace(/^[0-9０-９]+[.．、\s]*/, '')
    .trim();
}

function getNpcHeaders_() {
  return [
    'id',
    'name',
    'furigana',
    'birth_date',
    'age',
    'nationality',
    'birth_place',
    'occupation',
    'status',
    'organization_names',
    'organization_ids',
    'image_url',
    'profile',
    'person',
    'episodes',
    'scenario_ids',
    'related_npc_ids',
    'contactable_pc_ids',
    'location_ids',
    'memo',
    'pl_hidden',
    'edit_url',
    'form_response_id',
    'created_at',
    'updated_at'
  ];
}

function ensureNpcHeader_(sheet) {
  const headers = getNpcHeaders_();
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

  // 足りない列は末尾に1列ずつ追加（setValues の列数不一致を避ける）
  headers.forEach(name => {
    if (!present.has(name)) {
      const col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(name);
      present.add(name);
    }
  });

  return readSheetHeaders_(sheet);
}

function readSheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

function generateNpcId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'npc_001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNumber = 0;
  ids.forEach(id => {
    const match = String(id).match(/^npc_(\d+)$/);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });
  return 'npc_' + String(maxNumber + 1).padStart(3, '0');
}

function toDriveFileUrl_(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    const fileId = value[0];
    return fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : '';
  }
  const text = String(value);
  if (text.startsWith('http')) return text;
  return `https://drive.google.com/uc?export=view&id=${text}`;
}

function cleanStatus_(status) {
  return String(status).replace(/[＊*]/g, '').trim();
}

function pickAnswer_(answers, ...keys) {
  for (const key of keys) {
    if (answers[key] != null && String(answers[key]).trim() !== '') {
      return answers[key];
    }
  }
  return '';
}

function buildNpcRowFromAnswers_(answers, sheet, response) {
  const now = new Date();
  return {
    id: generateNpcId_(sheet),
    name: pickAnswer_(answers, 'NPC名'),
    furigana: pickAnswer_(answers, 'ふりがな'),
    birth_date: pickAnswer_(answers, '生年月日'),
    age: pickAnswer_(answers, '年齢'),
    nationality: pickAnswer_(answers, '国籍'),
    birth_place: pickAnswer_(answers, '出身地'),
    occupation: pickAnswer_(answers, '職業'),
    status: cleanStatus_(pickAnswer_(answers, '状態')),
    organization_names: pickAnswer_(answers, '所属組織'),
    organization_ids: '',
    image_url: toDriveFileUrl_(pickAnswer_(answers, 'NPC画像')),
    profile: pickAnswer_(answers, '人物紹介'),
    person: pickAnswer_(answers, '人物情報'),
    episodes: pickAnswer_(answers, 'エピソード'),
    scenario_ids: pickAnswer_(answers, '登場シナリオ'),
    related_npc_ids: pickAnswer_(answers, '関連NPC'),
    contactable_pc_ids: pickAnswer_(answers, '連絡可能PC'),
    location_ids: pickAnswer_(answers, '関連場所'),
    memo: pickAnswer_(answers, '備考'),
    pl_hidden: '',
    edit_url: response.getEditResponseUrl(),
    form_response_id: response.getId(),
    created_at: now,
    updated_at: now
  };
}

/**
 * フォーム送信トリガーに設定する関数（この名前で登録）
 */
function onNpcFormSubmit(e) {
  const ss = getSpreadsheetFromEvent_(e);
  const sheet = getOrCreateSheet_(ss, 'NPCS');
  const headers = ensureNpcHeader_(sheet);

  const response = e.response;
  const answers = getAnswers_(response);
  const rowData = buildNpcRowFromAnswers_(answers, sheet, response);
  const row = headers.map(header => rowData[header] ?? '');
  sheet.appendRow(row);
}

function doGet(e) {
  const ss = getArchiveSpreadsheet_();
  const type = (e && e.parameter && e.parameter.type) || 'npcs';
  const callback = e && e.parameter && e.parameter.callback;
  const kpMode = e && e.parameter && e.parameter.kp === '1';

  if (type === 'version') {
    return jsonResponse_({ api_version: '2026-06-17-org-form1' }, callback);
  }

  if (type === 'npcs') {
    const data = kpMode ? getKpNpcs_(ss) : getPublicNpcs_(ss);
    return jsonResponse_(data, callback);
  }

  if (type === 'organizations') {
    const data = kpMode ? getKpOrganizations_(ss) : getPublicOrganizations_(ss);
    return jsonResponse_(data, callback);
  }

  if (type === 'npc-visibility') {
    const id = String((e.parameter && e.parameter.id) || '').trim();
    const hiddenParam = e.parameter && e.parameter.hidden;
    if (!id) {
      return jsonResponse_({ error: 'missing id' }, callback);
    }
    const hidden = hiddenParam === '1' || hiddenParam === 'true';
    try {
      const result = setNpcPlHidden_(ss, id, hidden);
      return jsonResponse_(result, callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'chaugner-ranking') {
    return jsonResponse_(getChaugnerRanking_(ss), callback);
  }

  if (type === 'chaugner-score') {
    const name = String((e.parameter && e.parameter.name) || '').trim();
    const score = e.parameter && e.parameter.score;
    try {
      const result = saveChaugnerScore_(ss, name, score);
      return jsonResponse_(result, callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  return jsonResponse_({ error: 'unknown type', type: type }, callback);
}

function isPlHidden_(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'はい' || v === 'yes' ||
    v === '✓' || v === '非表示' || v === 'hidden';
}

function plHiddenCellValue_(hidden) {
  return hidden ? 'TRUE' : '';
}

function setNpcPlHidden_(ss, npcId, hidden) {
  const sheet = ss.getSheetByName('NPCS');
  if (!sheet) throw new Error('NPCS シートがありません');

  const headers = ensureNpcHeader_(sheet);
  const idCol = headers.indexOf('id') + 1;
  const hiddenCol = headers.indexOf('pl_hidden') + 1;
  if (idCol < 1 || hiddenCol < 1) throw new Error('pl_hidden 列がありません');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol - 1]).trim() === String(npcId).trim()) {
      sheet.getRange(i + 1, hiddenCol).setValue(plHiddenCellValue_(hidden));
      const updatedCol = headers.indexOf('updated_at') + 1;
      if (updatedCol > 0) {
        sheet.getRange(i + 1, updatedCol).setValue(new Date());
      }
      return { ok: true, id: npcId, pl_hidden: hidden };
    }
  }
  throw new Error('NPC が見つかりません: ' + npcId);
}

/** KPページ用 — 編集リンク付きの最小NPC一覧 */
function getKpNpcs_(ss) {
  const sheet = ss.getSheetByName('NPCS');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      return {
        id: record.id || '',
        name: record.name || '',
        furigana: record.furigana || '',
        occupation: record.occupation || '',
        status: record.status || '',
        image_url: record.image_url || '',
        pl_hidden: isPlHidden_(record.pl_hidden),
        edit_url: record.edit_url || ''
      };
    })
    .filter(npc => npc.id && npc.name);
}

function getPublicNpcs_(ss) {
  const sheet = ss.getSheetByName('NPCS');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());
  const adminKeys = new Set([
    'edit_url', 'form_response_id', 'created_at', 'updated_at', 'memo', 'pl_hidden'
  ]);

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      if (isPlHidden_(record.pl_hidden)) return null;
      adminKeys.forEach(key => delete record[key]);
      return record;
    })
    .filter(Boolean);
}

function jsonResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet || ss.insertSheet(sheetName);
}

/**
 * 本番用に NPCS シートを初期化（1回だけ手動実行）
 * プルダウンでは resetNpcSheetForProduction を選ぶ
 */
function getArchiveSpreadsheet_() {
  const form = FormApp.getActiveForm();
  if (form) return SpreadsheetApp.openById(form.getDestinationId());
  throw new Error('スプレッドシートを取得できません（フォーム紐付け GAS から実行してください）');
}

function getSpreadsheetFromEvent_(e) {
  if (e && e.response) {
    return SpreadsheetApp.openById(e.response.getSource().getDestinationId());
  }
  return getArchiveSpreadsheet_();
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

/**
 * 組織フォーム送信トリガーに設定する関数
 */
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

function getPublicOrganizations_(ss) {
  const sheet = ss.getSheetByName('ORGANIZATIONS');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());
  const adminKeys = new Set([
    'edit_url', 'form_response_id', 'created_at', 'updated_at', 'memo', 'pl_hidden'
  ]);

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      if (isPlHidden_(record.pl_hidden)) return null;
      adminKeys.forEach(key => delete record[key]);
      return record;
    })
    .filter(Boolean);
}

/** KPページ用 — 編集リンク付き組織一覧 */
function getKpOrganizations_(ss) {
  const sheet = ss.getSheetByName('ORGANIZATIONS');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      return {
        id: record.id || '',
        name: record.name || '',
        icon: record.icon || '🏛️',
        summary: record.summary || '',
        pl_hidden: isPlHidden_(record.pl_hidden),
        edit_url: record.edit_url || ''
      };
    })
    .filter(org => org.id && org.name);
}

function resetOrganizationSheetForProduction() {
  const ss = getArchiveSpreadsheet_();
  const headers = getOrgHeaders_();
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const archiveName = 'ORGANIZATIONS_archive_' + stamp;

  const existing = ss.getSheetByName('ORGANIZATIONS');
  if (existing) {
    if (ss.getSheetByName(archiveName)) {
      throw new Error(archiveName + ' が既にあります。');
    }
    existing.setName(archiveName);
  }

  const sheet = ss.insertSheet('ORGANIZATIONS');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  return '完了: 新しい ORGANIZATIONS シートを作成しました。旧データは ' + archiveName + ' にあります。';
}

function resetNpcSheetForProduction() {
  const ss = getArchiveSpreadsheet_();
  const headers = getNpcHeaders_();
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const archiveName = 'NPCS_archive_' + stamp;

  const existing = ss.getSheetByName('NPCS');
  if (existing) {
    if (ss.getSheetByName(archiveName)) {
      throw new Error(archiveName + ' が既にあります。アーカイブ名を変えるか削除してください。');
    }
    existing.setName(archiveName);
  }

  const sheet = ss.insertSheet('NPCS', 0);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  return '完了: 新しい NPCS シートを作成しました。旧データは ' + archiveName + ' にあります。';
}

/* ---- チャウグナー・ラン スコア API ---- */

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
