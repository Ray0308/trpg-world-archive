/**
 * YOKOFOLIA — フォーム → スプレッドシート → 公開 API
 *
 * プロジェクト名:
 *   DBPJ   … スプレッドシート（データ保存）
 *   NPCPJ  … このファイル（NPC登録 + 公開 API + NPC↔組織ID解決）
 *   組織PJ … docs/gas-org-form-bound.gs（組織フォーム送信 → ORGANIZATIONS 転記）
 *
 * NPC:  トリガー onNpcFormSubmit（NPCPJ / NPCフォーム）
 * 組織: トリガー onOrganizationFormSubmit（組織PJ / 組織フォーム）— 別ファイル
 * 両フォームの回答先は **同じ DBPJ** にすること
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

function splitList_(value) {
  if (!value) return [];
  return String(value)
    .split(/[,、|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function orgNameMatches_(part, orgName) {
  const p = String(part || '').trim();
  const name = String(orgName || '').trim();
  if (!p || !name) return false;
  return name === p || p.indexOf(name) >= 0 || name.indexOf(p) >= 0;
}

/**
 * 所属組織（名前）から ORGANIZATIONS シートを引いて ID を解決
 */
function resolveOrganizationIdsFromNames_(ss, namesText) {
  const parts = splitList_(namesText);
  if (!parts.length) return '';

  const sheet = ss.getSheetByName('ORGANIZATIONS');
  if (!sheet || sheet.getLastRow() <= 1) return '';

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.indexOf('name');
  if (idIdx < 0 || nameIdx < 0) return '';

  const orgs = values.slice(1)
    .filter(row => row[idIdx])
    .map(row => ({
      id: String(row[idIdx]).trim(),
      name: String(row[nameIdx] || '').trim()
    }));

  const matched = [];
  const seen = new Set();
  parts.forEach(part => {
    orgs.forEach(org => {
      if (orgNameMatches_(part, org.name) && !seen.has(org.id)) {
        seen.add(org.id);
        matched.push(org.id);
      }
    });
  });
  return matched.join(', ');
}

function buildNpcRowFromAnswers_(answers, sheet, response, ss) {
  const now = new Date();
  const organizationNames = pickAnswer_(answers, '所属組織');
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
    organization_names: organizationNames,
    organization_ids: resolveOrganizationIdsFromNames_(ss, organizationNames),
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
  rememberArchiveSpreadsheet_(ss);
  const sheet = getOrCreateSheet_(ss, 'NPCS');
  const headers = ensureNpcHeader_(sheet);

  const response = e.response;
  const answers = getAnswers_(response);
  const rowData = buildNpcRowFromAnswers_(answers, sheet, response, ss);
  const row = headers.map(header => rowData[header] ?? '');
  sheet.appendRow(row);
}

/**
 * 既存 NPC 行の organization_ids を所属組織名から一括更新（手動で1回実行）
 * ※ 実行ログには return が出ません。ログの「お知らせ」行に結果が出ます。
 */
function syncNpcOrganizationIds() {
  const ss = getArchiveSpreadsheet_();
  const sheet = ss.getSheetByName('NPCS');
  if (!sheet || sheet.getLastRow() <= 1) {
    const msg = 'NPCS シートにデータがありません';
    Logger.log(msg);
    return msg;
  }

  const headers = readSheetHeaders_(sheet);
  const namesIdx = headers.indexOf('organization_names');
  const idsIdx = headers.indexOf('organization_ids');
  if (namesIdx < 0 || idsIdx < 0) {
    const msg = 'organization_names / organization_ids 列が見つかりません';
    Logger.log(msg);
    return msg;
  }

  const lastRow = sheet.getLastRow();
  let updated = 0;
  let skippedEmpty = 0;
  let skippedNoMatch = 0;

  for (let row = 2; row <= lastRow; row++) {
    const names = sheet.getRange(row, namesIdx + 1).getValue();
    const namesText = String(names || '').trim();
    if (!namesText) {
      skippedEmpty++;
      continue;
    }
    const resolved = resolveOrganizationIdsFromNames_(ss, names);
    if (!resolved) {
      skippedNoMatch++;
      Logger.log('行' + row + ': 一致する組織なし — 「' + namesText + '」');
      continue;
    }
    const current = String(sheet.getRange(row, idsIdx + 1).getValue() || '').trim();
    if (resolved !== current) {
      sheet.getRange(row, idsIdx + 1).setValue(resolved);
      updated++;
      Logger.log('行' + row + ': ' + resolved);
    }
  }

  const msg = '完了: ' + updated + ' 行を更新（空欄スキップ ' + skippedEmpty +
    ' / 組織名不一致 ' + skippedNoMatch + '）';
  Logger.log(msg);
  return msg;
}

function doGet(e) {
  const ss = getArchiveSpreadsheet_();
  const type = (e && e.parameter && e.parameter.type) || 'npcs';
  const callback = e && e.parameter && e.parameter.callback;
  const kpMode = e && e.parameter && e.parameter.kp === '1';

  if (type === 'version') {
    return jsonResponse_({
      api_version: '2026-06-28-links',
      capabilities: [
        'npcs',
        'organizations',
        'scenarios',
        'pcs',
        'links',
        'npc-visibility',
        'org-visibility',
        'scenario-visibility',
        'pc-visibility',
        'chaugner-ranking',
        'chaugner-score'
      ]
    }, callback);
  }

  if (type === 'links') {
    const data = kpMode ? getKpLinks_(ss) : getPublicLinks_(ss);
    return jsonResponse_(data, callback);
  }

  if (type === 'npcs') {
    const data = kpMode ? getKpNpcs_(ss) : getPublicNpcs_(ss);
    return jsonResponse_(data, callback);
  }

  if (type === 'organizations') {
    const data = kpMode ? getKpOrganizations_(ss) : getPublicOrganizations_(ss);
    return jsonResponse_(data, callback);
  }

  if (type === 'scenarios') {
    const data = kpMode ? getKpScenarios_(ss) : getPublicScenarios_(ss);
    return jsonResponse_(data, callback);
  }

  if (type === 'pcs') {
    const data = kpMode ? getKpPcs_(ss) : getPublicPcs_(ss);
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

  if (type === 'org-visibility') {
    const id = String((e.parameter && e.parameter.id) || '').trim();
    const hiddenParam = e.parameter && e.parameter.hidden;
    if (!id) {
      return jsonResponse_({ error: 'missing id' }, callback);
    }
    const hidden = hiddenParam === '1' || hiddenParam === 'true';
    try {
      const result = setOrgPlHidden_(ss, id, hidden);
      return jsonResponse_(result, callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'scenario-visibility') {
    const id = String((e.parameter && e.parameter.id) || '').trim();
    const hiddenParam = e.parameter && e.parameter.hidden;
    if (!id) {
      return jsonResponse_({ error: 'missing id' }, callback);
    }
    const hidden = hiddenParam === '1' || hiddenParam === 'true';
    try {
      const result = setScenarioPlHidden_(ss, id, hidden);
      return jsonResponse_(result, callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'pc-visibility') {
    const id = String((e.parameter && e.parameter.id) || '').trim();
    const hiddenParam = e.parameter && e.parameter.hidden;
    if (!id) {
      return jsonResponse_({ error: 'missing id' }, callback);
    }
    const hidden = hiddenParam === '1' || hiddenParam === 'true';
    try {
      const result = setPcPlHidden_(ss, id, hidden);
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

function setOrgPlHidden_(ss, orgId, hidden) {
  const sheet = ss.getSheetByName('ORGANIZATIONS');
  if (!sheet) throw new Error('ORGANIZATIONS シートがありません');

  const headers = ensureOrgHeader_(sheet);
  const idCol = headers.indexOf('id') + 1;
  const hiddenCol = headers.indexOf('pl_hidden') + 1;
  if (idCol < 1 || hiddenCol < 1) throw new Error('pl_hidden 列がありません');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol - 1]).trim() === String(orgId).trim()) {
      sheet.getRange(i + 1, hiddenCol).setValue(plHiddenCellValue_(hidden));
      const updatedCol = headers.indexOf('updated_at') + 1;
      if (updatedCol > 0) {
        sheet.getRange(i + 1, updatedCol).setValue(new Date());
      }
      return { ok: true, id: orgId, pl_hidden: hidden };
    }
  }
  throw new Error('組織が見つかりません: ' + orgId);
}

function setScenarioPlHidden_(ss, scenarioId, hidden) {
  const sheet = ss.getSheetByName('SCENARIOS');
  if (!sheet) throw new Error('SCENARIOS シートがありません');

  const headers = ensureScenarioHeader_(sheet);
  const idCol = headers.indexOf('id') + 1;
  const hiddenCol = headers.indexOf('pl_hidden') + 1;
  if (idCol < 1 || hiddenCol < 1) throw new Error('pl_hidden 列がありません');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol - 1]).trim() === String(scenarioId).trim()) {
      sheet.getRange(i + 1, hiddenCol).setValue(plHiddenCellValue_(hidden));
      const updatedCol = headers.indexOf('updated_at') + 1;
      if (updatedCol > 0) {
        sheet.getRange(i + 1, updatedCol).setValue(new Date());
      }
      return { ok: true, id: scenarioId, pl_hidden: hidden };
    }
  }
  throw new Error('シナリオが見つかりません: ' + scenarioId);
}

function getPcHeaders_() {
  return [
    'id',
    'name',
    'player_name',
    'sheet_url',
    'image_url',
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

  return sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

function setPcPlHidden_(ss, pcId, hidden) {
  const sheet = ss.getSheetByName('PCS');
  if (!sheet) throw new Error('PCS シートがありません');

  const headers = ensurePcHeader_(sheet);
  const idCol = headers.indexOf('id') + 1;
  const hiddenCol = headers.indexOf('pl_hidden') + 1;
  if (idCol < 1 || hiddenCol < 1) throw new Error('pl_hidden 列がありません');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol - 1]).trim() === String(pcId).trim()) {
      sheet.getRange(i + 1, hiddenCol).setValue(plHiddenCellValue_(hidden));
      const updatedCol = headers.indexOf('updated_at') + 1;
      if (updatedCol > 0) {
        sheet.getRange(i + 1, updatedCol).setValue(new Date());
      }
      return { ok: true, id: pcId, pl_hidden: hidden };
    }
  }
  throw new Error('PC が見つかりません: ' + pcId);
}

function getScenarioHeaders_() {
  return [
    'id',
    'title',
    'era',
    'summary',
    'npc_names',
    'npc_ids',
    'organization_names',
    'organization_ids',
    'pc_names',
    'pc_ids',
    'related_scenario_names',
    'related_scenario_ids',
    'memo',
    'pl_hidden',
    'edit_url',
    'form_response_id',
    'created_at',
    'updated_at'
  ];
}

function ensureScenarioHeader_(sheet) {
  const headers = getScenarioHeaders_();
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
const ARCHIVE_SPREADSHEET_ID_KEY = 'archive_spreadsheet_id';

function rememberArchiveSpreadsheet_(ss) {
  if (ss && ss.getId) {
    PropertiesService.getScriptProperties().setProperty(ARCHIVE_SPREADSHEET_ID_KEY, ss.getId());
  }
}

function getArchiveSpreadsheet_() {
  const form = FormApp.getActiveForm();
  if (form) {
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    rememberArchiveSpreadsheet_(ss);
    return ss;
  }
  const cachedId = PropertiesService.getScriptProperties().getProperty(ARCHIVE_SPREADSHEET_ID_KEY);
  if (cachedId) return SpreadsheetApp.openById(cachedId);
  throw new Error('スプレッドシートを取得できません。NPCフォームを1件送信するか、NPCフォームのスクリプトエディタから実行してください');
}

const ALLOWED_LINK_KEYS_ = ['cocofolia', 'iachara', 'discord'];

function ensureSettingsSheet_(ss) {
  let sheet = ss.getSheetByName('SETTINGS');
  if (!sheet) {
    sheet = ss.insertSheet('SETTINGS');
    sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'memo']]);
    sheet.getRange(2, 1, 4, 3).setValues([
      ['cocofolia', 'https://ccfolia.com/', 'ココフォリアの部屋URL（例: https://ccfolia.com/rooms/...）'],
      ['discord', '', '空欄ならサイト既定の Discord URL'],
      ['iachara', '', '空欄ならサイト既定のいあきゃら URL']
    ]);
  }
  return sheet;
}

function getSettingsSheetUrl_(ss) {
  const sheet = ensureSettingsSheet_(ss);
  return ss.getUrl() + '#gid=' + sheet.getSheetId();
}

function getPublicLinks_(ss) {
  const sheet = ensureSettingsSheet_(ss);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};

  const headers = values[0].map(h => String(h).trim().toLowerCase());
  const keyIdx = headers.indexOf('key');
  const valIdx = headers.indexOf('value');
  if (keyIdx < 0 || valIdx < 0) return {};

  const links = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][keyIdx] || '').trim();
    const value = String(values[i][valIdx] || '').trim();
    if (!key || ALLOWED_LINK_KEYS_.indexOf(key) < 0) continue;
    if (!value || value === '#') continue;
    links[key] = value;
  }
  return links;
}

/** KPページ用 — 外部リンク + SETTINGS シート URL */
function getKpLinks_(ss) {
  return {
    ...getPublicLinks_(ss),
    _settings_sheet_url: getSettingsSheetUrl_(ss)
  };
}

/** SETTINGS シートを初回作成（NPCPJ から ▶ 実行） */
function setupSettingsSheet() {
  const ss = getArchiveSpreadsheet_();
  ensureSettingsSheet_(ss);
  const msg = 'SETTINGS シートを用意しました: ' + getSettingsSheetUrl_(ss);
  Logger.log(msg);
  return msg;
}

function getFormFromEvent_(e) {
  if (e && e.source && typeof e.source.getDestinationId === 'function') {
    return e.source;
  }
  if (e && e.response && typeof e.response.getSource === 'function') {
    return e.response.getSource();
  }
  return FormApp.getActiveForm() || null;
}

function getSpreadsheetFromEvent_(e) {
  const form = getFormFromEvent_(e);
  if (form) {
    return SpreadsheetApp.openById(form.getDestinationId());
  }
  return getArchiveSpreadsheet_();
}

function getSpreadsheetFromSubmitEvent_(e) {
  if (e && e.source && typeof e.source.getId === 'function') {
    const ss = e.source;
    rememberArchiveSpreadsheet_(ss);
    return ss;
  }
  return getSpreadsheetFromEvent_(e);
}

function isOrganizationFormTitle_(title) {
  return /組織/.test(String(title));
}

function normalizeSheetHeader_(title) {
  const t = normalizeTitle_(title);
  return t === 'タイムスタンプ' ? '' : t;
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

function answersFromNamedValues_(namedValues) {
  const answers = {};
  Object.keys(namedValues || {}).forEach(key => {
    const k = normalizeSheetHeader_(key);
    if (!k) return;
    const v = namedValues[key];
    answers[k] = Array.isArray(v) ? v[0] : v;
  });
  return answers;
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
    edit_url: m.editUrl || (response ? response.getEditResponseUrl() : ''),
    form_response_id: m.formResponseId || (response ? response.getId() : ''),
    created_at: now,
    updated_at: now
  };
}

function appendOrganizationFromAnswers_(ss, answers, meta) {
  rememberArchiveSpreadsheet_(ss);
  const orgSheet = getOrCreateSheet_(ss, 'ORGANIZATIONS');
  const headers = ensureOrgHeader_(orgSheet);
  const rowData = buildOrgRowFromAnswers_(answers, orgSheet, meta);

  if (!String(rowData.name || '').trim()) {
    Logger.log('ORG skip: 組織名が空');
    return null;
  }
  if (rowData.form_response_id &&
      isOrgResponseAlreadyImported_(orgSheet, rowData.form_response_id)) {
    Logger.log('ORG skip duplicate response: ' + rowData.form_response_id);
    return null;
  }

  const row = headers.map(header => rowData[header] ?? '');
  orgSheet.appendRow(row);
  Logger.log('ORG imported: ' + rowData.id + ' / ' + rowData.name);
  return rowData.id;
}

/**
 * 組織フォーム送信 → ORGANIZATIONS 転記（3通りのイベント形式に対応）
 */
function processOrganizationSubmitFromEvent_(e) {
  if (!e) {
    Logger.log('ORG skip: event なし');
    return;
  }

  const ss = getSpreadsheetFromSubmitEvent_(e);

  if (e.response) {
    const form = getFormFromEvent_(e);
    const title = form ? form.getTitle() : '';
    if (!isOrganizationFormTitle_(title)) {
      Logger.log('ORG skip form: ' + title);
      return;
    }
    appendOrganizationFromAnswers_(ss, getAnswers_(e.response), { response: e.response });
    return;
  }

  if (e.namedValues) {
    const answers = answersFromNamedValues_(e.namedValues);
    if (!pickAnswer_(answers, '組織名')) {
      Logger.log('ORG skip namedValues: 組織名なし');
      return;
    }
    appendOrganizationFromAnswers_(ss, answers, {});
    return;
  }

  if (e.range) {
    const sheet = e.range.getSheet();
    const rowIndex = e.range.getRow();
    if (rowIndex < 2) return;
    const answers = answersFromResponseSheetRow_(sheet, rowIndex);
    if (!pickAnswer_(answers, '組織名')) {
      Logger.log('ORG skip range: ' + sheet.getName() + ' 行' + rowIndex);
      return;
    }
    appendOrganizationFromAnswers_(ss, answers, {});
    return;
  }

  Logger.log('ORG skip: 処理できる event データなし');
}

/**
 * トリガー: スプレッドシートから → フォーム送信時（組織転記）
 * 入力PJ に追加。スプレッドシートは TRPG World Archive DB を選択。
 */
function onSpreadsheetFormSubmit(e) {
  try {
    processOrganizationSubmitFromEvent_(e);
  } catch (err) {
    Logger.log('onSpreadsheetFormSubmit ERROR: ' + (err.message || err));
    throw err;
  }
}

/**
 * @deprecated 組織フォーム側トリガー用。onSpreadsheetFormSubmit を推奨。
 */
function onOrganizationFormSubmit(e) {
  processOrganizationSubmitFromEvent_(e);
}

/**
 * 診断（▶ 実行）。結果は実行ログに出ます。
 */
function checkOrgSetup() {
  const ss = getArchiveSpreadsheet_();
  const responseSheet = findOrgResponseSheet_(ss);
  const orgSheet = ss.getSheetByName('ORGANIZATIONS');
  const lines = [
    'スプレッドシート: ' + ss.getName(),
    '組織の回答シート: ' + (responseSheet
      ? responseSheet.getName() + '（' + Math.max(0, responseSheet.getLastRow() - 1) + '件）'
      : '見つかりません'),
    'ORGANIZATIONS: ' + (orgSheet ? Math.max(0, orgSheet.getLastRow() - 1) + '件' : 'まだ無い')
  ];
  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}

/**
 * 回答シートの最後の1行を手動取り込み
 */
function importLastOrgResponse() {
  const ss = getArchiveSpreadsheet_();
  const responseSheet = findOrgResponseSheet_(ss);
  if (!responseSheet) {
    const msg = '「組織名」列がある回答シートが見つかりません';
    Logger.log(msg);
    return msg;
  }
  const lastRow = responseSheet.getLastRow();
  if (lastRow < 2) {
    const msg = '組織フォームの回答がまだありません';
    Logger.log(msg);
    return msg;
  }
  const answers = answersFromResponseSheetRow_(responseSheet, lastRow);
  const id = appendOrganizationFromAnswers_(ss, answers, {});
  const msg = id
    ? '取り込み: ' + id + ' / ' + pickAnswer_(answers, '組織名')
    : '取り込みスキップ（重複または組織名空）';
  Logger.log(msg);
  return msg;
}

/**
 * 回答シートの未取り込み行を一括取り込み（▶ で1回実行）
 */
function importAllOrgResponses() {
  const ss = getArchiveSpreadsheet_();
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
    if (!name) {
      skipped++;
      continue;
    }
    if (isOrgNameAlreadyImported_(orgSheet, name)) {
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

function getPublicScenarios_(ss) {
  const sheet = ss.getSheetByName('SCENARIOS');
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

/** KPページ用 — 編集リンク付きシナリオ一覧 */
function getKpScenarios_(ss) {
  const sheet = ss.getSheetByName('SCENARIOS');
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
        title: record.title || '',
        era: record.era || '',
        summary: record.summary || '',
        pl_hidden: isPlHidden_(record.pl_hidden),
        edit_url: record.edit_url || ''
      };
    })
    .filter(sc => sc.id && sc.title);
}

function getPublicPcs_(ss) {
  const sheet = ss.getSheetByName('PCS');
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

/** KPページ用 — 編集リンク付き PC 一覧 */
function getKpPcs_(ss) {
  const sheet = ss.getSheetByName('PCS');
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
        player_name: record.player_name || '',
        sheet_url: record.sheet_url || '',
        image_url: record.image_url || '',
        pl_hidden: isPlHidden_(record.pl_hidden),
        edit_url: record.edit_url || ''
      };
    })
    .filter(pc => pc.id && pc.name);
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
