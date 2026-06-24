/**
 * YOKOFOLIA — シナリオPJ 専用（シナリオ入力フォームに紐づける）
 *
 *   DBPJ      … スプレッドシート（TRPG World Archive DB）
 *   NPCPJ     … docs/gas-npc-form.gs（公開 API）
 *   シナリオPJ … このファイル（フォーム送信 → SCENARIOS 転記）
 *
 * KP は名前だけ入力（ID 不要）。GAS が NPC / 組織 / PC / シナリオ名から ID を解決します。
 *
 * セットアップ:
 * 1. シナリオ入力フォーム → ⋮ → スクリプトエディタ（シナリオPJ）
 * 2. この内容を Code.gs に貼り付けて保存
 * 3. トリガー → onScenarioFormSubmit / フォームから / 送信時
 * 4. importAllScenarioResponses を ▶ 実行（任意）
 *
 * デプロイ不要。API は NPCPJ を再デプロイ（?type=scenarios）。
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

function splitList_(value) {
  if (!value) return [];
  return String(value)
    .split(/[,、|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function nameMatches_(part, fullName) {
  const p = String(part || '').trim();
  const name = String(fullName || '').trim();
  if (!p || !name) return false;
  return name === p || p.indexOf(name) >= 0 || name.indexOf(p) >= 0;
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
  throw new Error('DBPJ を取得できません（シナリオPJ＝シナリオフォームに紐づけてください）');
}

function getSpreadsheetFromEvent_(e) {
  const form = getFormFromEvent_(e);
  return SpreadsheetApp.openById(form.getDestinationId());
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

function generateScenarioId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'scn_001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNumber = 0;
  ids.forEach(id => {
    const match = String(id).match(/^scn_(\d+)$/i);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });
  return 'scn_' + String(maxNumber + 1).padStart(3, '0');
}

function readEntitiesFromSheet_(ss, sheetName, idHeader, nameHeader) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idIdx = headers.indexOf(idHeader);
  const nameIdx = headers.indexOf(nameHeader);
  if (idIdx < 0 || nameIdx < 0) return [];

  return values.slice(1)
    .filter(row => row[idIdx])
    .map(row => ({
      id: String(row[idIdx]).trim(),
      name: String(row[nameIdx] || '').trim()
    }));
}

function resolveIdsFromEntities_(parts, entities, options) {
  const opts = options || {};
  const matched = [];
  const seen = new Set();

  parts.forEach(part => {
    const p = String(part || '').trim();
    if (!p) return;

    if (opts.allowId && /^scn_\d+$/i.test(p)) {
      const found = entities.find(e => String(e.id).trim().toLowerCase() === p.toLowerCase());
      if (found && !seen.has(found.id)) {
        seen.add(found.id);
        matched.push(found.id);
        return;
      }
    }

    entities.forEach(entity => {
      if (nameMatches_(p, entity.name) && !seen.has(entity.id)) {
        seen.add(entity.id);
        matched.push(entity.id);
      }
    });
  });

  return matched.join(', ');
}

function resolveNpcIdsFromNames_(ss, namesText) {
  const parts = splitList_(namesText);
  if (!parts.length) return '';
  const npcs = readEntitiesFromSheet_(ss, 'NPCS', 'id', 'name');
  return resolveIdsFromEntities_(parts, npcs.map(n => ({ id: n.id, name: n.name })));
}

function resolveOrgIdsFromNames_(ss, namesText) {
  const parts = splitList_(namesText);
  if (!parts.length) return '';
  const orgs = readEntitiesFromSheet_(ss, 'ORGANIZATIONS', 'id', 'name');
  return resolveIdsFromEntities_(parts, orgs.map(o => ({ id: o.id, name: o.name })));
}

function resolvePcIdsFromNames_(ss, namesText) {
  const parts = splitList_(namesText);
  if (!parts.length) return '';
  const pcs = readEntitiesFromSheet_(ss, 'PCS', 'id', 'name');
  return resolveIdsFromEntities_(parts, pcs.map(p => ({ id: p.id, name: p.name })));
}

function resolveRelatedScenarioIds_(ss, namesText, excludeId) {
  const parts = splitList_(namesText);
  if (!parts.length) return '';
  const scenarios = readEntitiesFromSheet_(ss, 'SCENARIOS', 'id', 'title')
    .filter(sc => sc.id !== excludeId);
  return resolveIdsFromEntities_(parts, scenarios.map(s => ({ id: s.id, name: s.name })), {
    allowId: true
  });
}

function findScenarioResponseSheet_(ss) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const width = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, width).getValues()[0]
      .map(h => normalizeSheetHeader_(h))
      .filter(Boolean);
    if (headers.indexOf('シナリオ名') >= 0) return sheet;
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

function isScenarioResponseAlreadyImported_(sheet, formResponseId) {
  if (!formResponseId) return false;
  const headers = readSheetHeaders_(sheet);
  const idx = headers.indexOf('form_response_id');
  if (idx < 0) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().flat();
  return values.some(v => String(v).trim() === String(formResponseId).trim());
}

function isScenarioTitleAlreadyImported_(sheet, title) {
  const t = String(title || '').trim();
  if (!t) return false;
  const headers = readSheetHeaders_(sheet);
  const idx = headers.indexOf('title');
  if (idx < 0) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().flat();
  return values.some(v => String(v).trim() === t);
}

function mergeCsvIds_(current, addIds) {
  const set = new Set(splitList_(current));
  (addIds || []).forEach(id => {
    const t = String(id || '').trim();
    if (t) set.add(t);
  });
  return [...set].join(', ');
}

function readNpcSheetHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0]
    .map(h => String(h).trim())
    .filter(Boolean);
}

/** シナリオ登録時: SCENARIOS の登場NPC → NPCS の scenario_ids を更新 */
function linkNpcsToScenario_(ss, scenarioId, npcIdsText) {
  const npcIds = splitList_(npcIdsText);
  if (!npcIds.length) return 0;

  const npcSheet = ss.getSheetByName('NPCS');
  if (!npcSheet || npcSheet.getLastRow() <= 1) {
    Logger.log('SCN link skip: NPCS が空');
    return 0;
  }

  const headers = readNpcSheetHeaders_(npcSheet);
  const idIdx = headers.indexOf('id');
  const scenarioIdsIdx = headers.indexOf('scenario_ids');
  if (idIdx < 0 || scenarioIdsIdx < 0) return 0;

  const targetIds = new Set(npcIds);
  let updated = 0;
  const lastRow = npcSheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    const npcId = String(npcSheet.getRange(row, idIdx + 1).getValue() || '').trim();
    if (!targetIds.has(npcId)) continue;

    const curIds = String(npcSheet.getRange(row, scenarioIdsIdx + 1).getValue() || '').trim();
    const newIds = mergeCsvIds_(curIds, [scenarioId]);
    if (newIds !== curIds) {
      npcSheet.getRange(row, scenarioIdsIdx + 1).setValue(newIds);
      updated++;
    }
  }

  Logger.log('SCN link NPCs: ' + updated + ' 行更新 (' + scenarioId + ')');
  return updated;
}

/** シナリオ登録時: SCENARIOS の登場組織 → ORGANIZATIONS の scenario_ids を更新 */
function linkOrgsToScenario_(ss, scenarioId, orgIdsText) {
  const orgIds = splitList_(orgIdsText);
  if (!orgIds.length) return 0;

  const orgSheet = ss.getSheetByName('ORGANIZATIONS');
  if (!orgSheet || orgSheet.getLastRow() <= 1) {
    Logger.log('SCN link skip: ORGANIZATIONS が空');
    return 0;
  }

  const headers = readSheetHeaders_(orgSheet);
  const idIdx = headers.indexOf('id');
  const scenarioIdsIdx = headers.indexOf('scenario_ids');
  if (idIdx < 0 || scenarioIdsIdx < 0) return 0;

  const targetIds = new Set(orgIds);
  let updated = 0;
  const lastRow = orgSheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    const orgId = String(orgSheet.getRange(row, idIdx + 1).getValue() || '').trim();
    if (!targetIds.has(orgId)) continue;

    const curIds = String(orgSheet.getRange(row, scenarioIdsIdx + 1).getValue() || '').trim();
    const newIds = mergeCsvIds_(curIds, [scenarioId]);
    if (newIds !== curIds) {
      orgSheet.getRange(row, scenarioIdsIdx + 1).setValue(newIds);
      updated++;
    }
  }

  Logger.log('SCN link orgs: ' + updated + ' 行更新 (' + scenarioId + ')');
  return updated;
}

function buildScenarioRowFromAnswers_(answers, sheet, meta, ss) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;
  const id = generateScenarioId_(sheet);

  const npcNames = pickAnswer_(answers, '登場NPC');
  const orgNames = pickAnswer_(answers, '登場組織');
  const pcNames = pickAnswer_(answers, '関連PC');
  const relatedNames = pickAnswer_(answers, '関連シナリオ');

  return {
    id: id,
    title: pickAnswer_(answers, 'シナリオ名'),
    era: pickAnswer_(answers, '年代'),
    summary: pickAnswer_(answers, '概要'),
    npc_names: npcNames,
    npc_ids: ss ? resolveNpcIdsFromNames_(ss, npcNames) : '',
    organization_names: orgNames,
    organization_ids: ss ? resolveOrgIdsFromNames_(ss, orgNames) : '',
    pc_names: pcNames,
    pc_ids: ss ? resolvePcIdsFromNames_(ss, pcNames) : '',
    related_scenario_names: relatedNames,
    related_scenario_ids: ss ? resolveRelatedScenarioIds_(ss, relatedNames, id) : '',
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

function logUnresolvedNames_(label, namesText, idsText) {
  if (!namesText || idsText) return;
  Logger.log('SCN warn: ' + label + ' に一致なし — 「' + namesText + '」');
}

function appendScenarioFromAnswers_(ss, answers, meta) {
  const scSheet = getOrCreateSheet_(ss, 'SCENARIOS');
  const headers = ensureScenarioHeader_(scSheet);
  const rowData = buildScenarioRowFromAnswers_(answers, scSheet, meta, ss);

  if (!String(rowData.title || '').trim()) {
    Logger.log('SCN skip: シナリオ名が空');
    return null;
  }
  if (rowData.form_response_id &&
      isScenarioResponseAlreadyImported_(scSheet, rowData.form_response_id)) {
    Logger.log('SCN skip duplicate: ' + rowData.form_response_id);
    return null;
  }

  logUnresolvedNames_('登場NPC', rowData.npc_names, rowData.npc_ids);
  logUnresolvedNames_('登場組織', rowData.organization_names, rowData.organization_ids);
  logUnresolvedNames_('関連PC', rowData.pc_names, rowData.pc_ids);
  logUnresolvedNames_('関連シナリオ', rowData.related_scenario_names, rowData.related_scenario_ids);

  const row = headers.map(header => rowData[header] ?? '');
  scSheet.appendRow(row);
  linkNpcsToScenario_(ss, rowData.id, rowData.npc_ids);
  linkOrgsToScenario_(ss, rowData.id, rowData.organization_ids);
  Logger.log('SCN imported: ' + rowData.id + ' / ' + rowData.title);
  return rowData.id;
}

function onScenarioFormSubmit(e) {
  try {
    const ss = getSpreadsheetFromEvent_(e);
    const response = e.response;
    const answers = getAnswers_(response);
    appendScenarioFromAnswers_(ss, answers, { response: response });
  } catch (err) {
    Logger.log('onScenarioFormSubmit ERROR: ' + (err.message || err));
    throw err;
  }
}

function checkScenarioSetup() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = 'シナリオPJ（シナリオフォームのスクリプトエディタ）から実行してください';
    Logger.log(msg);
    return msg;
  }
  const spreadsheet = SpreadsheetApp.openById(form.getDestinationId());
  const responseSheet = findScenarioResponseSheet_(spreadsheet);
  const scSheet = spreadsheet.getSheetByName('SCENARIOS');
  const msg = [
    'DBPJ: ' + spreadsheet.getName(),
    'シナリオの回答シート: ' + (responseSheet
      ? responseSheet.getName() + '（' + Math.max(0, responseSheet.getLastRow() - 1) + '件）'
      : '見つかりません'),
    'SCENARIOS: ' + (scSheet ? Math.max(0, scSheet.getLastRow() - 1) + '件' : 'まだ無い'),
    'NPCS: ' + (spreadsheet.getSheetByName('NPCS')
      ? Math.max(0, spreadsheet.getSheetByName('NPCS').getLastRow() - 1) + '件' : '0件')
  ].join('\n');
  Logger.log(msg);
  return msg;
}

function importAllScenarioResponses() {
  const form = FormApp.getActiveForm();
  if (!form) {
    const msg = 'シナリオPJ から実行してください';
    Logger.log(msg);
    return msg;
  }
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const responseSheet = findScenarioResponseSheet_(ss);
  if (!responseSheet) {
    const msg = 'シナリオの回答シートが見つかりません';
    Logger.log(msg);
    return msg;
  }

  const scSheet = getOrCreateSheet_(ss, 'SCENARIOS');
  const lastRow = responseSheet.getLastRow();
  let imported = 0;
  let skipped = 0;

  for (let row = 2; row <= lastRow; row++) {
    const answers = answersFromResponseSheetRow_(responseSheet, row);
    const title = pickAnswer_(answers, 'シナリオ名');
    if (!title || isScenarioTitleAlreadyImported_(scSheet, title)) {
      skipped++;
      continue;
    }
    const id = appendScenarioFromAnswers_(ss, answers, {});
    if (id) imported++;
    else skipped++;
  }

  const msg = '一括取り込み: ' + imported + ' 件追加 / ' + skipped + ' 件スキップ';
  Logger.log(msg);
  return msg;
}

function upgradeScenarioSheet() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('シナリオPJ から実行してください');
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const sheet = getOrCreateSheet_(ss, 'SCENARIOS');
  const before = readSheetHeaders_(sheet);
  const after = ensureScenarioHeader_(sheet);
  const added = after.filter(h => !before.includes(h));
  const msg = added.length
    ? 'SCENARIOS に列を追加: ' + added.join(', ')
    : 'SCENARIOS の列は最新です';
  Logger.log(msg);
  return msg;
}
