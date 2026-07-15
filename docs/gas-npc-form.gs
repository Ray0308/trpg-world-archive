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
    'deleted',
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
    deleted: '',
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
      api_version: '2026-06-28-migo',
      capabilities: [
        'npcs',
        'organizations',
        'scenarios',
        'pcs',
        'npc-visibility',
        'org-visibility',
        'scenario-visibility',
        'pc-visibility',
        'npc-delete',
        'org-delete',
        'scenario-delete',
        'pc-delete',
        'chaugner-ranking',
        'chaugner-score',
        'migo-balance',
        'migo-redeem',
        'migo-play',
        'migo-play-end',
        'migo-ranking',
        'migo-gift-create',
        'migo-kp-players',
        'migo-kp-grant',
        'migo-kp-rename',
        'migo-set-active',
        'migo-shop-catalog',
        'migo-shop-buy',
        'migo-shop-kp-list',
        'migo-shop-kp-set-active',
        'migo-shop-kp-set-stock',
        'migo-shop-kp-delete',
        'migo-shop-kp-sales'
      ]
    }, callback);
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

  if (type === 'npc-delete') {
    return handleEntityDelete_(ss, 'NPCS', ensureNpcHeader_, idFromParam_(e), deletedFromParam_(e), 'NPC', callback);
  }

  if (type === 'org-delete') {
    return handleEntityDelete_(ss, 'ORGANIZATIONS', ensureOrgHeader_, idFromParam_(e), deletedFromParam_(e), '組織', callback);
  }

  if (type === 'scenario-delete') {
    return handleEntityDelete_(ss, 'SCENARIOS', ensureScenarioHeader_, idFromParam_(e), deletedFromParam_(e), 'シナリオ', callback);
  }

  if (type === 'pc-delete') {
    return handleEntityDelete_(ss, 'PCS', ensurePcHeader_, idFromParam_(e), deletedFromParam_(e), 'PC', callback);
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

  if (type === 'migo-balance') {
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    try {
      return jsonResponse_(getMigoBalance_(ss, playerName), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-redeem') {
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    const code = String((e.parameter && e.parameter.code) || '').trim();
    try {
      return jsonResponse_(redeemMigoGiftCode_(ss, playerName, code), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-play') {
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    const pcId = String((e.parameter && e.parameter.pc_id) || '').trim();
    try {
      return jsonResponse_(startMigoPlay_(ss, playerName, pcId), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-play-end') {
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    const playId = String((e.parameter && e.parameter.play_id) || '').trim();
    const won = e.parameter && (e.parameter.won === '1' || e.parameter.won === 'true');
    const cosmeticId = String((e.parameter && e.parameter.cosmetic_id) || '').trim();
    try {
      return jsonResponse_(finishMigoPlay_(ss, playerName, playId, won, cosmeticId), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-ranking') {
    return jsonResponse_(getMigoRanking_(ss), callback);
  }

  if (type === 'migo-gift-create') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    const coins = e.parameter && e.parameter.coins;
    const maxUses = e.parameter && e.parameter.max_uses;
    const expiresDays = e.parameter && e.parameter.expires_days;
    const memo = String((e.parameter && e.parameter.memo) || '').trim();
    try {
      return jsonResponse_(createMigoGiftCode_(ss, coins, maxUses, expiresDays, memo), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-kp-players') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    return jsonResponse_(getMigoKpPlayers_(ss), callback);
  }

  if (type === 'migo-kp-grant') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    const coins = e.parameter && e.parameter.coins;
    try {
      return jsonResponse_(grantMigoCoinsKp_(ss, playerName, coins), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-kp-rename') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    const oldName = String((e.parameter && e.parameter.old_name) || '').trim();
    const newName = String((e.parameter && e.parameter.new_name) || '').trim();
    try {
      return jsonResponse_(renameMigoPlayerCoins_(ss, oldName, newName), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-set-active') {
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    const pcId = String((e.parameter && e.parameter.pc_id) || '').trim();
    const cosmeticId = String((e.parameter && e.parameter.cosmetic_id) || '').trim();
    try {
      return jsonResponse_(setMigoActiveCosmetic_(ss, playerName, pcId, cosmeticId), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-catalog') {
    try {
      return jsonResponse_(getMigoShopCatalog_(ss), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-buy') {
    const playerName = String((e.parameter && e.parameter.player_name) || '').trim();
    const productId = String((e.parameter && e.parameter.product_id) || '').trim();
    const clientRequestId = String((e.parameter && e.parameter.client_request_id) || '').trim();
    try {
      return jsonResponse_(buyMigoShopProduct_(ss, playerName, productId, clientRequestId), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-kp-list') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    try {
      return jsonResponse_(getKpMigoShopProducts_(ss), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-kp-set-active') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    const productId = String((e.parameter && e.parameter.product_id) || '').trim();
    const active = e.parameter && (e.parameter.active === '1' || e.parameter.active === 'true');
    try {
      return jsonResponse_(setMigoShopProductActive_(ss, productId, active), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-kp-set-stock') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    const productId = String((e.parameter && e.parameter.product_id) || '').trim();
    const stock = e.parameter && e.parameter.stock;
    try {
      return jsonResponse_(setMigoShopProductStock_(ss, productId, stock), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-kp-delete') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    const productId = String((e.parameter && e.parameter.product_id) || '').trim();
    const deleted = !(e.parameter && (e.parameter.deleted === '0' || e.parameter.deleted === 'false'));
    try {
      return jsonResponse_(setMigoShopProductDeleted_(ss, productId, deleted), callback);
    } catch (err) {
      return jsonResponse_({ error: err.message || String(err) }, callback);
    }
  }

  if (type === 'migo-shop-kp-sales') {
    if (!kpMode) {
      return jsonResponse_({ error: 'kp mode required' }, callback);
    }
    try {
      return jsonResponse_(getKpMigoShopSales_(ss), callback);
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

function isDeleted_(value) {
  return isPlHidden_(value);
}

function plHiddenCellValue_(hidden) {
  return hidden ? 'TRUE' : '';
}

function deletedCellValue_(deleted) {
  return deleted ? 'TRUE' : '';
}

function idFromParam_(e) {
  return String((e && e.parameter && e.parameter.id) || '').trim();
}

function deletedFromParam_(e) {
  const p = e && e.parameter && e.parameter.deleted;
  return p === '1' || p === 'true';
}

function handleEntityDelete_(ss, sheetName, ensureHeaderFn, entityId, deleted, label, callback) {
  if (!entityId) {
    return jsonResponse_({ error: 'missing id' }, callback);
  }
  try {
    const result = setEntityDeleted_(ss, sheetName, ensureHeaderFn, entityId, deleted, label);
    return jsonResponse_(result, callback);
  } catch (err) {
    return jsonResponse_({ error: err.message || String(err) }, callback);
  }
}

function setEntityDeleted_(ss, sheetName, ensureHeaderFn, entityId, deleted, label) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + ' シートがありません');

  const headers = ensureHeaderFn(sheet);
  const idCol = headers.indexOf('id') + 1;
  const deletedCol = headers.indexOf('deleted') + 1;
  if (idCol < 1 || deletedCol < 1) throw new Error('deleted 列がありません');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol - 1]).trim() === String(entityId).trim()) {
      sheet.getRange(i + 1, deletedCol).setValue(deletedCellValue_(deleted));
      const updatedCol = headers.indexOf('updated_at') + 1;
      if (updatedCol > 0) {
        sheet.getRange(i + 1, updatedCol).setValue(new Date());
      }
      return { ok: true, id: entityId, deleted: deleted };
    }
  }
  throw new Error(label + ' が見つかりません: ' + entityId);
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
    'deleted',
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
        deleted: isDeleted_(record.deleted),
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
    'edit_url', 'form_response_id', 'created_at', 'updated_at', 'memo', 'pl_hidden', 'deleted'
  ]);

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      if (isDeleted_(record.deleted)) return null;
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
  // スプレッドシートの「フォーム送信時」: e.source は Spreadsheet
  // フォームの「フォーム送信時」: e.source は Form（getId だけでは区別できない）
  if (e && e.source && typeof e.source.getSheets === 'function') {
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
    'deleted',
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

function findOrgSheetRowByFormResponseId_(orgSheet, formResponseId) {
  const id = String(formResponseId || '').trim();
  if (!id) return 0;
  const headers = readSheetHeaders_(orgSheet);
  const idx = headers.indexOf('form_response_id');
  if (idx < 0) return 0;
  const lastRow = orgSheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const value = String(orgSheet.getRange(row, idx + 1).getValue() || '').trim();
    if (value === id) return row;
  }
  return 0;
}

function readOrgRowAsObject_(orgSheet, rowIndex, headers) {
  const width = headers.length;
  const values = orgSheet.getRange(rowIndex, 1, 1, width).getValues()[0];
  const record = {};
  headers.forEach((header, index) => {
    if (header) record[header] = values[index];
  });
  return record;
}

function buildOrgRowFromAnswers_(answers, sheet, meta, existing) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;
  const ex = existing || {};
  return {
    id: ex.id || generateOrgId_(sheet),
    name: pickAnswer_(answers, '組織名'),
    icon: pickAnswer_(answers, 'アイコン') || ex.icon || '🏛️',
    summary: pickAnswer_(answers, '概要'),
    description: pickAnswer_(answers, '説明'),
    location_id: ex.location_id || '',
    location_name: pickAnswer_(answers, '所在地'),
    scenario_ids: pickAnswer_(answers, '関連シナリオ'),
    member_npc_names: pickAnswer_(answers, '所属NPC') || ex.member_npc_names || '',
    member_npc_ids: ex.member_npc_ids || '',
    memo: pickAnswer_(answers, '備考'),
    pl_hidden: ex.pl_hidden != null && ex.pl_hidden !== '' ? ex.pl_hidden : '',
    deleted: ex.deleted != null && ex.deleted !== '' ? ex.deleted : '',
    edit_url: m.editUrl || (response && typeof response.getEditResponseUrl === 'function'
      ? response.getEditResponseUrl() : (ex.edit_url || '')),
    form_response_id: m.formResponseId || (response && typeof response.getId === 'function'
      ? response.getId() : (ex.form_response_id || '')),
    created_at: ex.created_at || now,
    updated_at: now
  };
}

function appendOrganizationFromAnswers_(ss, answers, meta) {
  rememberArchiveSpreadsheet_(ss);
  const orgSheet = getOrCreateSheet_(ss, 'ORGANIZATIONS');
  const headers = ensureOrgHeader_(orgSheet);
  const m = meta || {};
  const response = m.response;
  const formResponseId = m.formResponseId || (response && typeof response.getId === 'function'
    ? response.getId() : '');
  const existingRow = formResponseId
    ? findOrgSheetRowByFormResponseId_(orgSheet, formResponseId)
    : 0;
  const existing = existingRow > 0
    ? readOrgRowAsObject_(orgSheet, existingRow, headers)
    : null;
  const rowData = buildOrgRowFromAnswers_(answers, orgSheet, meta, existing);

  if (!String(rowData.name || '').trim()) {
    Logger.log('ORG skip: 組織名が空');
    return null;
  }

  const row = headers.map(header => rowData[header] ?? '');

  if (existingRow > 0) {
    orgSheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    Logger.log('ORG updated: ' + rowData.id + ' / ' + rowData.name);
    return rowData.id;
  }

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
    'form_response_id', 'created_at', 'updated_at', 'memo', 'pl_hidden', 'deleted'
  ]);

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      if (isDeleted_(record.deleted)) return null;
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
        deleted: isDeleted_(record.deleted),
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
    'edit_url', 'form_response_id', 'created_at', 'updated_at', 'memo', 'pl_hidden', 'deleted'
  ]);

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      if (isDeleted_(record.deleted)) return null;
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
        deleted: isDeleted_(record.deleted),
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
    'form_response_id', 'created_at', 'updated_at', 'memo', 'pl_hidden', 'deleted'
  ]);
  const cosmeticsByPc = getMigoCosmeticsByPc_(ss);
  const activeByPc = getMigoActiveByPc_(ss);

  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });
      if (isDeleted_(record.deleted)) return null;
      if (isPlHidden_(record.pl_hidden)) return null;
      adminKeys.forEach(key => delete record[key]);
      const pcId = String(record.id || '').trim();
      const owned = cosmeticsByPc[pcId] || [];
      record.cosmetics = owned;
      record.active_cosmetics = sanitizeMigoActiveCosmetics_(owned, activeByPc[pcId] || {});
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
        deleted: isDeleted_(record.deleted),
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
  const migoBonus = grantMigoChaugnerBonus_(ss, cleanName, cleanScore);
  return {
    ok: true,
    name: cleanName,
    score: cleanScore,
    migo_coins_added: migoBonus.added,
    migo_balance: migoBonus.balance
  };
}

/* ---- ミ＝ゴキャッチャー API ---- */

const MIGO_BASE_COSMETICS_ = [
  'frame-fungal', 'bg-nebula', 'title-whisper', 'frame-bone',
  'fx-glimpse', 'bg-void', 'frame-ether', 'title-migo',
  'frame-coral', 'bg-mycelium', 'title-deep', 'frame-spore',
  'bg-plateau', 'title-probe', 'frame-rune', 'bg-star',
  'title-dream', 'fx-buzz', 'fx-pollen', 'fx-tentacle'
];

const MIGO_COMP_COSMETIC_ = 'frame-migo-wing';

const MIGO_COSMETIC_SLOT_ = {
  'frame-fungal': 'frame',
  'frame-bone': 'frame',
  'frame-ether': 'frame',
  'frame-coral': 'frame',
  'frame-spore': 'frame',
  'frame-rune': 'frame',
  'frame-migo-wing': 'frame',
  'bg-nebula': 'bg',
  'bg-void': 'bg',
  'bg-mycelium': 'bg',
  'bg-plateau': 'bg',
  'bg-star': 'bg',
  'title-whisper': 'title',
  'title-migo': 'title',
  'title-deep': 'title',
  'title-probe': 'title',
  'title-dream': 'title',
  'fx-glimpse': 'fx',
  'fx-buzz': 'fx',
  'fx-pollen': 'fx',
  'fx-tentacle': 'fx'
};

const MIGO_PLAY_COST_ = 1;
const MIGO_PLAY_MAX_AGE_MS_ = 30 * 60 * 1000;
const MIGO_CHAUGNER_METERS_PER_COIN_ = 1000;
const MIGO_CHAUGNER_MAX_COINS_ = 2;

function normalizeMigoPlayerName_(name) {
  return String(name || '').trim().slice(0, 24);
}

function isValidMigoCosmeticId_(cosmeticId) {
  return MIGO_BASE_COSMETICS_.indexOf(cosmeticId) >= 0 ||
    cosmeticId === MIGO_COMP_COSMETIC_;
}

function ensureMigoCoinsSheet_(ss) {
  const headers = ['player_name', 'balance', 'updated_at'];
  let sheet = ss.getSheetByName('MIGO_COINS');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_COINS');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureMigoGiftCodesSheet_(ss) {
  const headers = ['code', 'coins', 'max_uses', 'used_count', 'expires_at', 'created_at', 'memo'];
  let sheet = ss.getSheetByName('MIGO_GIFT_CODES');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_GIFT_CODES');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureMigoUnlocksSheet_(ss) {
  const headers = ['pc_id', 'cosmetic_id', 'player_name', 'unlocked_at'];
  let sheet = ss.getSheetByName('MIGO_UNLOCKS');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_UNLOCKS');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureMigoPlaysSheet_(ss) {
  const headers = ['play_id', 'player_name', 'pc_id', 'status', 'cosmetic_id', 'created_at'];
  let sheet = ss.getSheetByName('MIGO_PLAYS');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_PLAYS');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureMigoActiveSheet_(ss) {
  const headers = ['pc_id', 'slot', 'cosmetic_id', 'player_name', 'updated_at'];
  let sheet = ss.getSheetByName('MIGO_ACTIVE');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_ACTIVE');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function sanitizeMigoActiveCosmetics_(ownedIds, activeMap) {
  const owned = ownedIds || [];
  const out = {};
  if (!activeMap) return out;
  Object.keys(activeMap).forEach(slot => {
    const id = String(activeMap[slot] || '').trim();
    if (!id) return;
    if (owned.indexOf(id) < 0) return;
    if (MIGO_COSMETIC_SLOT_[id] !== slot) return;
    out[slot] = id;
  });
  return out;
}

function getMigoActiveForPc_(ss, pcId) {
  const sheet = ensureMigoActiveSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const map = {};
  if (values.length <= 1) {
    return sanitizeMigoActiveCosmetics_(getMigoCosmeticsForPc_(ss, pcId), map);
  }

  const headers = values[0].map(h => String(h).trim());
  const pcCol = headers.indexOf('pc_id');
  const slotCol = headers.indexOf('slot');
  const cosmeticCol = headers.indexOf('cosmetic_id');
  if (pcCol < 0 || slotCol < 0 || cosmeticCol < 0) {
    return sanitizeMigoActiveCosmetics_(getMigoCosmeticsForPc_(ss, pcId), map);
  }

  values.slice(1).forEach(row => {
    if (String(row[pcCol]).trim() !== String(pcId).trim()) return;
    const slot = String(row[slotCol]).trim();
    const cosmeticId = String(row[cosmeticCol]).trim();
    if (slot && cosmeticId) map[slot] = cosmeticId;
  });

  return sanitizeMigoActiveCosmetics_(getMigoCosmeticsForPc_(ss, pcId), map);
}

function getMigoActiveByPc_(ss) {
  const sheet = ensureMigoActiveSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const map = {};
  if (values.length <= 1) return map;

  const headers = values[0].map(h => String(h).trim());
  const pcCol = headers.indexOf('pc_id');
  const slotCol = headers.indexOf('slot');
  const cosmeticCol = headers.indexOf('cosmetic_id');
  if (pcCol < 0 || slotCol < 0 || cosmeticCol < 0) return map;

  values.slice(1).forEach(row => {
    const pcId = String(row[pcCol]).trim();
    const slot = String(row[slotCol]).trim();
    const cosmeticId = String(row[cosmeticCol]).trim();
    if (!pcId || !slot || !cosmeticId) return;
    if (!map[pcId]) map[pcId] = {};
    map[pcId][slot] = cosmeticId;
  });
  return map;
}

function setMigoActiveCosmetic_(ss, playerName, pcId, cosmeticId) {
  const cleanPcId = String(pcId || '').trim();
  const id = String(cosmeticId || '').trim();
  if (!cleanPcId) throw new Error('pc_id is required');
  if (!id) throw new Error('cosmetic_id is required');
  if (!isValidMigoCosmeticId_(id)) throw new Error('cosmetic_id が無効です');

  assertPcOwnedByPlayer_(ss, cleanPcId, playerName);
  const owned = getMigoCosmeticsForPc_(ss, cleanPcId);
  if (owned.indexOf(id) < 0) throw new Error('未入手のコスメです');

  const slot = MIGO_COSMETIC_SLOT_[id];
  if (!slot) throw new Error('装備スロットが不明です');

  const sheet = ensureMigoActiveSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const pcCol = headers.indexOf('pc_id') + 1;
  const slotCol = headers.indexOf('slot') + 1;
  const cosmeticCol = headers.indexOf('cosmetic_id') + 1;
  const playerCol = headers.indexOf('player_name') + 1;
  const updatedCol = headers.indexOf('updated_at') + 1;
  const now = new Date();
  const name = normalizeMigoPlayerName_(playerName);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][pcCol - 1]).trim() !== cleanPcId) continue;
    if (String(values[i][slotCol - 1]).trim() !== slot) continue;
    sheet.getRange(i + 1, cosmeticCol).setValue(id);
    if (playerCol > 0) sheet.getRange(i + 1, playerCol).setValue(name);
    if (updatedCol > 0) sheet.getRange(i + 1, updatedCol).setValue(now);
    return {
      ok: true,
      pc_id: cleanPcId,
      cosmetic_id: id,
      slot: slot,
      active_cosmetics: getMigoActiveForPc_(ss, cleanPcId),
      cosmetics: owned
    };
  }

  sheet.appendRow([cleanPcId, slot, id, name, now]);
  return {
    ok: true,
    pc_id: cleanPcId,
    cosmetic_id: id,
    slot: slot,
    active_cosmetics: getMigoActiveForPc_(ss, cleanPcId),
    cosmetics: owned
  };
}

function findPcRecord_(ss, pcId) {
  const sheet = ss.getSheetByName('PCS');
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0].map(h => String(h).trim());
  const idCol = headers.indexOf('id');
  if (idCol < 0) return null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]).trim() === String(pcId).trim()) {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = values[i][index];
      });
      if (isDeleted_(record.deleted)) return null;
      return record;
    }
  }
  return null;
}

function assertPcOwnedByPlayer_(ss, pcId, playerName) {
  const pc = findPcRecord_(ss, pcId);
  if (!pc) throw new Error('PCが見つかりません');
  const owner = normalizeMigoPlayerName_(pc.player_name);
  const player = normalizeMigoPlayerName_(playerName);
  if (!owner || !player || owner !== player) {
    throw new Error('プレイヤー名とPCの登録が一致しません');
  }
  return pc;
}

function getMigoBalance_(ss, playerName) {
  const name = normalizeMigoPlayerName_(playerName);
  if (!name) throw new Error('player_name is required');
  const sheet = ensureMigoCoinsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { ok: true, player_name: name, balance: 0 };

  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name');
  const balanceCol = headers.indexOf('balance');
  if (nameCol < 0 || balanceCol < 0) return { ok: true, player_name: name, balance: 0 };

  for (let i = 1; i < values.length; i++) {
    if (normalizeMigoPlayerName_(values[i][nameCol]) === name) {
      return {
        ok: true,
        player_name: name,
        balance: Math.max(0, Number(values[i][balanceCol]) || 0)
      };
    }
  }
  return { ok: true, player_name: name, balance: 0 };
}

function addMigoCoins_(ss, playerName, amount) {
  const name = normalizeMigoPlayerName_(playerName);
  const delta = Math.max(0, Math.floor(Number(amount) || 0));
  if (!name) throw new Error('player_name is required');
  if (delta <= 0) return getMigoBalance_(ss, name);

  const sheet = ensureMigoCoinsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name') + 1;
  const balanceCol = headers.indexOf('balance') + 1;
  const updatedCol = headers.indexOf('updated_at') + 1;
  const now = new Date();

  for (let i = 1; i < values.length; i++) {
    if (normalizeMigoPlayerName_(values[i][nameCol - 1]) === name) {
      const next = Math.max(0, (Number(values[i][balanceCol - 1]) || 0) + delta);
      sheet.getRange(i + 1, balanceCol).setValue(next);
      if (updatedCol > 0) sheet.getRange(i + 1, updatedCol).setValue(now);
      return { ok: true, player_name: name, balance: next, added: delta };
    }
  }

  sheet.appendRow([name, delta, now]);
  return { ok: true, player_name: name, balance: delta, added: delta };
}

function spendMigoCoins_(ss, playerName, amount) {
  const name = normalizeMigoPlayerName_(playerName);
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if (!name) throw new Error('player_name is required');
  if (cost <= 0) return getMigoBalance_(ss, name);

  const sheet = ensureMigoCoinsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name') + 1;
  const balanceCol = headers.indexOf('balance') + 1;
  const updatedCol = headers.indexOf('updated_at') + 1;
  const now = new Date();

  for (let i = 1; i < values.length; i++) {
    if (normalizeMigoPlayerName_(values[i][nameCol - 1]) === name) {
      const current = Math.max(0, Number(values[i][balanceCol - 1]) || 0);
      if (current < cost) throw new Error('コインが足りません');
      const next = current - cost;
      sheet.getRange(i + 1, balanceCol).setValue(next);
      if (updatedCol > 0) sheet.getRange(i + 1, updatedCol).setValue(now);
      return { ok: true, player_name: name, balance: next, spent: cost };
    }
  }
  throw new Error('コインが足りません');
}

function redeemMigoGiftCode_(ss, playerName, code) {
  const name = normalizeMigoPlayerName_(playerName);
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!name) throw new Error('player_name is required');
  if (!cleanCode) throw new Error('code is required');

  const sheet = ensureMigoGiftCodesSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) throw new Error('コードが無効です');

  const headers = values[0].map(h => String(h).trim());
  const codeCol = headers.indexOf('code') + 1;
  const coinsCol = headers.indexOf('coins') + 1;
  const maxUsesCol = headers.indexOf('max_uses') + 1;
  const usedCol = headers.indexOf('used_count') + 1;
  const expiresCol = headers.indexOf('expires_at') + 1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][codeCol - 1]).trim().toUpperCase() !== cleanCode) continue;

    const coins = Math.max(0, Number(values[i][coinsCol - 1]) || 0);
    const maxUses = Math.max(1, Number(values[i][maxUsesCol - 1]) || 1);
    const used = Math.max(0, Number(values[i][usedCol - 1]) || 0);
    const expiresAt = values[i][expiresCol - 1];

    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        throw new Error('コードの有効期限が切れています');
      }
    }
    if (used >= maxUses) throw new Error('コードは使用済みです');
    if (coins <= 0) throw new Error('コードが無効です');

    sheet.getRange(i + 1, usedCol).setValue(used + 1);
    const credited = addMigoCoins_(ss, name, coins);
    return {
      ok: true,
      player_name: name,
      code: cleanCode,
      coins_added: coins,
      balance: credited.balance
    };
  }
  throw new Error('コードが無効です');
}

function generateMigoGiftCodeString_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'MIGO-' + body;
}

function createMigoGiftCode_(ss, coins, maxUses, expiresDays, memo) {
  const cleanCoins = Math.max(1, Math.min(99, Math.floor(Number(coins) || 1)));
  const cleanMaxUses = Math.max(1, Math.min(999, Math.floor(Number(maxUses) || 1)));
  const days = Math.max(0, Math.min(365, Math.floor(Number(expiresDays) || 0)));
  const sheet = ensureMigoGiftCodesSheet_(ss);
  const now = new Date();
  const expiresAt = days > 0 ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : '';

  let code = '';
  for (let attempt = 0; attempt < 8; attempt++) {
    code = generateMigoGiftCodeString_();
    const existing = sheet.getDataRange().getValues().slice(1)
      .some(row => String(row[0]).trim().toUpperCase() === code);
    if (!existing) break;
  }

  sheet.appendRow([code, cleanCoins, cleanMaxUses, 0, expiresAt, now, memo || '']);
  return {
    ok: true,
    code: code,
    coins: cleanCoins,
    max_uses: cleanMaxUses,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : ''
  };
}

function startMigoPlay_(ss, playerName, pcId) {
  const name = normalizeMigoPlayerName_(playerName);
  const id = String(pcId || '').trim();
  if (!name) throw new Error('player_name is required');
  if (!id) throw new Error('pc_id is required');

  assertPcOwnedByPlayer_(ss, id, name);
  const spent = spendMigoCoins_(ss, name, MIGO_PLAY_COST_);
  const playId = 'play-' + Utilities.getUuid();
  const sheet = ensureMigoPlaysSheet_(ss);
  sheet.appendRow([playId, name, id, 'pending', '', new Date()]);

  return {
    ok: true,
    play_id: playId,
    player_name: name,
    pc_id: id,
    balance: spent.balance
  };
}

function findMigoPlayRow_(sheet, playId, playerName) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0].map(h => String(h).trim());
  const playCol = headers.indexOf('play_id');
  const nameCol = headers.indexOf('player_name');
  const statusCol = headers.indexOf('status');
  const createdCol = headers.indexOf('created_at');
  if (playCol < 0 || nameCol < 0 || statusCol < 0) return null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][playCol]).trim() !== String(playId).trim()) continue;
    if (normalizeMigoPlayerName_(values[i][nameCol]) !== normalizeMigoPlayerName_(playerName)) {
      throw new Error('プレイ情報が一致しません');
    }
    const createdAt = values[i][createdCol];
    if (createdAt) {
      const age = Date.now() - new Date(createdAt).getTime();
      if (age > MIGO_PLAY_MAX_AGE_MS_) throw new Error('プレイの有効期限が切れています');
    }
    return {
      rowIndex: i + 1,
      status: String(values[i][statusCol]).trim(),
      headers: headers,
      values: values[i]
    };
  }
  return null;
}

function getMigoCosmeticsForPc_(ss, pcId) {
  const sheet = ensureMigoUnlocksSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());
  const pcCol = headers.indexOf('pc_id');
  const cosmeticCol = headers.indexOf('cosmetic_id');
  if (pcCol < 0 || cosmeticCol < 0) return [];

  const ids = [];
  values.slice(1).forEach(row => {
    if (String(row[pcCol]).trim() === String(pcId).trim()) {
      const id = String(row[cosmeticCol]).trim();
      if (id && ids.indexOf(id) < 0) ids.push(id);
    }
  });
  return ids;
}

function getMigoCosmeticsByPc_(ss) {
  const sheet = ensureMigoUnlocksSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const map = {};
  if (values.length <= 1) return map;

  const headers = values[0].map(h => String(h).trim());
  const pcCol = headers.indexOf('pc_id');
  const cosmeticCol = headers.indexOf('cosmetic_id');
  if (pcCol < 0 || cosmeticCol < 0) return map;

  values.slice(1).forEach(row => {
    const pcId = String(row[pcCol]).trim();
    const cosmeticId = String(row[cosmeticCol]).trim();
    if (!pcId || !cosmeticId) return;
    if (!map[pcId]) map[pcId] = [];
    if (map[pcId].indexOf(cosmeticId) < 0) map[pcId].push(cosmeticId);
  });
  return map;
}

function unlockMigoCosmeticForPc_(ss, pcId, playerName, cosmeticId) {
  const id = String(cosmeticId || '').trim();
  if (!isValidMigoCosmeticId_(id)) throw new Error('cosmetic_id が無効です');

  const sheet = ensureMigoUnlocksSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const pcCol = headers.indexOf('pc_id') + 1;
  const cosmeticCol = headers.indexOf('cosmetic_id') + 1;
  const playerCol = headers.indexOf('player_name') + 1;
  const unlockedCol = headers.indexOf('unlocked_at') + 1;
  const now = new Date();

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][pcCol - 1]).trim() !== String(pcId).trim()) continue;
    const existingId = String(values[i][cosmeticCol - 1]).trim();
    if (existingId === id) {
      return getMigoCosmeticsForPc_(ss, pcId);
    }
  }

  sheet.appendRow([pcId, id, normalizeMigoPlayerName_(playerName), now]);
  const cosmetics = getMigoCosmeticsForPc_(ss, pcId);
  maybeGrantMigoCompBonus_(ss, pcId, playerName, cosmetics);
  return getMigoCosmeticsForPc_(ss, pcId);
}

function maybeGrantMigoCompBonus_(ss, pcId, playerName, cosmetics) {
  const owned = cosmetics || getMigoCosmeticsForPc_(ss, pcId);
  const hasAll = MIGO_BASE_COSMETICS_.every(id => owned.indexOf(id) >= 0);
  if (!hasAll) return;
  if (owned.indexOf(MIGO_COMP_COSMETIC_) >= 0) return;
  unlockMigoCosmeticForPc_(ss, pcId, playerName, MIGO_COMP_COSMETIC_);
}

function finishMigoPlay_(ss, playerName, playId, won, cosmeticId) {
  const name = normalizeMigoPlayerName_(playerName);
  const id = String(playId || '').trim();
  if (!name) throw new Error('player_name is required');
  if (!id) throw new Error('play_id is required');

  const sheet = ensureMigoPlaysSheet_(ss);
  const play = findMigoPlayRow_(sheet, id, name);
  if (!play) throw new Error('プレイが見つかりません');
  if (play.status !== 'pending') throw new Error('このプレイは既に完了しています');

  const headers = play.headers;
  const statusCol = headers.indexOf('status') + 1;
  const cosmeticCol = headers.indexOf('cosmetic_id') + 1;
  const pcCol = headers.indexOf('pc_id');
  const pcId = String(play.values[pcCol]).trim();

  if (won) {
    const cleanCosmetic = String(cosmeticId || '').trim();
    if (!isValidMigoCosmeticId_(cleanCosmetic) || MIGO_BASE_COSMETICS_.indexOf(cleanCosmetic) < 0) {
      throw new Error('cosmetic_id が無効です');
    }
    const beforeCosmetics = getMigoCosmeticsForPc_(ss, pcId);
    const hadComp = beforeCosmetics.indexOf(MIGO_COMP_COSMETIC_) >= 0;
    sheet.getRange(play.rowIndex, statusCol).setValue('won');
    sheet.getRange(play.rowIndex, cosmeticCol).setValue(cleanCosmetic);
    const cosmetics = unlockMigoCosmeticForPc_(ss, pcId, name, cleanCosmetic);
    return {
      ok: true,
      play_id: id,
      won: true,
      pc_id: pcId,
      cosmetic_id: cleanCosmetic,
      cosmetics: cosmetics,
      comp_granted: !hadComp && cosmetics.indexOf(MIGO_COMP_COSMETIC_) >= 0
    };
  }

  sheet.getRange(play.rowIndex, statusCol).setValue('lost');
  return { ok: true, play_id: id, won: false, pc_id: pcId };
}

function getMigoRanking_(ss) {
  const sheet = ensureMigoPlaysSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name');
  const statusCol = headers.indexOf('status');
  if (nameCol < 0 || statusCol < 0) return [];

  const counts = {};
  values.slice(1).forEach(row => {
    if (String(row[statusCol]).trim() !== 'won') return;
    const name = normalizeMigoPlayerName_(row[nameCol]);
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });

  return Object.keys(counts)
    .map(name => ({ player_name: name, gets: counts[name] }))
    .sort((a, b) => b.gets - a.gets || a.player_name.localeCompare(b.player_name))
    .slice(0, 10);
}

function grantMigoChaugnerBonus_(ss, playerName, score) {
  const meters = Math.max(0, Math.floor(Number(score) || 0));
  const coins = Math.min(
    MIGO_CHAUGNER_MAX_COINS_,
    Math.floor(meters / MIGO_CHAUGNER_METERS_PER_COIN_)
  );
  if (coins <= 0) {
    const bal = getMigoBalance_(ss, playerName);
    return { added: 0, balance: bal.balance };
  }
  const credited = addMigoCoins_(ss, playerName, coins);
  return { added: credited.added || coins, balance: credited.balance };
}

function setMigoBalance_(ss, playerName, balance) {
  const name = normalizeMigoPlayerName_(playerName);
  const next = Math.max(0, Math.floor(Number(balance) || 0));
  if (!name) throw new Error('player_name is required');

  const sheet = ensureMigoCoinsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name') + 1;
  const balanceCol = headers.indexOf('balance') + 1;
  const updatedCol = headers.indexOf('updated_at') + 1;
  const now = new Date();

  for (let i = 1; i < values.length; i++) {
    if (normalizeMigoPlayerName_(values[i][nameCol - 1]) === name) {
      sheet.getRange(i + 1, balanceCol).setValue(next);
      if (updatedCol > 0) sheet.getRange(i + 1, updatedCol).setValue(now);
      return { ok: true, player_name: name, balance: next };
    }
  }

  sheet.appendRow([name, next, now]);
  return { ok: true, player_name: name, balance: next };
}

function deleteMigoPlayerCoins_(ss, playerName) {
  const name = normalizeMigoPlayerName_(playerName);
  if (!name) return false;
  const sheet = ensureMigoCoinsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name');
  if (nameCol < 0) return false;

  for (let i = values.length - 1; i >= 1; i--) {
    if (normalizeMigoPlayerName_(values[i][nameCol]) === name) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getMigoKpPlayers_(ss) {
  const pcs = getKpPcs_(ss);
  const players = new Map();

  pcs.forEach(pc => {
    if (pc.deleted) return;
    const name = normalizeMigoPlayerName_(pc.player_name);
    if (!name) return;
    if (!players.has(name)) {
      players.set(name, { player_name: name, pcs: [] });
    }
    players.get(name).pcs.push({ id: pc.id, name: pc.name || pc.id });
  });

  const sheet = ensureMigoCoinsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const balances = {};
  if (values.length > 1) {
    const headers = values[0].map(h => String(h).trim());
    const nameCol = headers.indexOf('player_name');
    const balanceCol = headers.indexOf('balance');
    if (nameCol >= 0 && balanceCol >= 0) {
      values.slice(1).forEach(row => {
        const name = normalizeMigoPlayerName_(row[nameCol]);
        if (!name) return;
        balances[name] = Math.max(0, Number(row[balanceCol]) || 0);
      });
    }
  }

  const rows = [];
  players.forEach((info, name) => {
    rows.push({
      player_name: name,
      balance: balances[name] || 0,
      pcs: info.pcs,
      registered: true
    });
    delete balances[name];
  });

  Object.keys(balances).forEach(name => {
    rows.push({
      player_name: name,
      balance: balances[name],
      pcs: [],
      registered: false,
      orphan: true
    });
  });

  rows.sort((a, b) => a.player_name.localeCompare(b.player_name, 'ja'));
  return { ok: true, players: rows };
}

function grantMigoCoinsKp_(ss, playerName, coins) {
  const name = normalizeMigoPlayerName_(playerName);
  const amount = Math.max(1, Math.min(999, Math.floor(Number(coins) || 0)));
  if (!name) throw new Error('player_name is required');
  const credited = addMigoCoins_(ss, name, amount);
  return {
    ok: true,
    player_name: name,
    coins_added: amount,
    balance: credited.balance
  };
}

function renameMigoPlayerCoins_(ss, oldName, newName) {
  const oldN = normalizeMigoPlayerName_(oldName);
  const newN = normalizeMigoPlayerName_(newName);
  if (!oldN || !newN) throw new Error('old_name と new_name が必要です');
  if (oldN === newN) {
    const bal = getMigoBalance_(ss, newN);
    return { ok: true, player_name: newN, balance: bal.balance, merged_from: oldN };
  }

  const oldBal = getMigoBalance_(ss, oldN).balance;
  const newBal = getMigoBalance_(ss, newN).balance;
  const merged = oldBal + newBal;
  setMigoBalance_(ss, newN, merged);
  if (oldN !== newN) deleteMigoPlayerCoins_(ss, oldN);

  return {
    ok: true,
    player_name: newN,
    balance: merged,
    merged_from: oldN,
    note: 'PCのプレイヤー名もフォーム編集で合わせてください'
  };
}

/* ---- マリウスの露天商（ミゴコインショップ） ---- */

function ensureMigoShopProductsSheet_(ss) {
  const headers = [
    'product_id', 'name', 'description', 'image_url', 'price', 'stock',
    'active', 'sort_order', 'deleted', 'edit_url', 'form_response_id',
    'created_at', 'updated_at', 'memo'
  ];
  let sheet = ss.getSheetByName('MIGO_SHOP_PRODUCTS');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_SHOP_PRODUCTS');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureMigoShopPurchasesSheet_(ss) {
  const headers = [
    'purchase_id', 'player_name', 'product_id', 'product_name',
    'price_paid', 'qty', 'purchased_at', 'client_request_id'
  ];
  let sheet = ss.getSheetByName('MIGO_SHOP_PURCHASES');
  if (!sheet) {
    sheet = ss.insertSheet('MIGO_SHOP_PURCHASES');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }
  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (firstRow.every(v => v === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function isMigoShopActive_(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return false;
  return v === 'true' || v === '1' || v === 'はい' || v === 'yes' || v === '公開';
}

function mapMigoShopProductRow_(headers, row) {
  const record = {};
  headers.forEach((header, index) => {
    if (header) record[header] = row[index];
  });
  const productId = String(record.product_id || '').trim();
  if (!productId) return null;
  return {
    product_id: productId,
    name: String(record.name || '').trim(),
    description: String(record.description || '').trim(),
    image_url: String(record.image_url || '').trim(),
    price: Math.max(0, Math.floor(Number(record.price) || 0)),
    stock: Math.max(0, Math.floor(Number(record.stock) || 0)),
    active: isMigoShopActive_(record.active),
    sort_order: Math.floor(Number(record.sort_order) || 0),
    deleted: isDeleted_(record.deleted),
    edit_url: String(record.edit_url || '').trim(),
    form_response_id: String(record.form_response_id || '').trim(),
    memo: String(record.memo || '').trim(),
    created_at: record.created_at || '',
    updated_at: record.updated_at || ''
  };
}

function readMigoShopProducts_(ss) {
  const sheet = ensureMigoShopProductsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .map(row => mapMigoShopProductRow_(headers, row))
    .filter(Boolean);
}

function findMigoShopProductRow_(ss, productId) {
  const sheet = ensureMigoShopProductsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0].map(h => String(h).trim());
  const idCol = headers.indexOf('product_id');
  if (idCol < 0) return null;
  const cleanId = String(productId || '').trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]).trim() === cleanId) {
      return {
        sheet: sheet,
        headers: headers,
        rowIndex: i + 1,
        values: values[i],
        product: mapMigoShopProductRow_(headers, values[i])
      };
    }
  }
  return null;
}

function getMigoShopCatalog_(ss) {
  const products = readMigoShopProducts_(ss)
    .filter(p => !p.deleted && p.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ja'));
  return {
    ok: true,
    shop_name: 'マリウスの露天商',
    products: products.map(p => ({
      product_id: p.product_id,
      name: p.name,
      description: p.description,
      image_url: p.image_url,
      price: p.price,
      stock: p.stock,
      sort_order: p.sort_order
    }))
  };
}

function getKpMigoShopProducts_(ss) {
  const products = readMigoShopProducts_(ss)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ja'));
  return { ok: true, products: products };
}

function setMigoShopProductActive_(ss, productId, active) {
  const found = findMigoShopProductRow_(ss, productId);
  if (!found || !found.product) throw new Error('商品が見つかりません');
  if (found.product.deleted) throw new Error('削除済みの商品です');
  const activeCol = found.headers.indexOf('active') + 1;
  const updatedCol = found.headers.indexOf('updated_at') + 1;
  if (activeCol <= 0) throw new Error('active 列がありません');
  found.sheet.getRange(found.rowIndex, activeCol).setValue(active ? true : false);
  if (updatedCol > 0) found.sheet.getRange(found.rowIndex, updatedCol).setValue(new Date());
  return { ok: true, product_id: found.product.product_id, active: !!active };
}

function setMigoShopProductStock_(ss, productId, stock) {
  const found = findMigoShopProductRow_(ss, productId);
  if (!found || !found.product) throw new Error('商品が見つかりません');
  if (found.product.deleted) throw new Error('削除済みの商品です');
  const next = Math.max(0, Math.floor(Number(stock)));
  if (!isFinite(next)) throw new Error('在庫数が不正です');
  const stockCol = found.headers.indexOf('stock') + 1;
  const updatedCol = found.headers.indexOf('updated_at') + 1;
  if (stockCol <= 0) throw new Error('stock 列がありません');
  found.sheet.getRange(found.rowIndex, stockCol).setValue(next);
  if (updatedCol > 0) found.sheet.getRange(found.rowIndex, updatedCol).setValue(new Date());
  return { ok: true, product_id: found.product.product_id, stock: next };
}

function setMigoShopProductDeleted_(ss, productId, deleted) {
  const found = findMigoShopProductRow_(ss, productId);
  if (!found || !found.product) throw new Error('商品が見つかりません');
  const deletedCol = found.headers.indexOf('deleted') + 1;
  const activeCol = found.headers.indexOf('active') + 1;
  const updatedCol = found.headers.indexOf('updated_at') + 1;
  if (deletedCol <= 0) throw new Error('deleted 列がありません');
  found.sheet.getRange(found.rowIndex, deletedCol).setValue(deleted ? true : false);
  if (deleted && activeCol > 0) {
    found.sheet.getRange(found.rowIndex, activeCol).setValue(false);
  }
  if (updatedCol > 0) found.sheet.getRange(found.rowIndex, updatedCol).setValue(new Date());
  return { ok: true, product_id: found.product.product_id, deleted: !!deleted };
}

function findMigoShopPurchaseByClientRequest_(ss, playerName, clientRequestId) {
  const id = String(clientRequestId || '').trim();
  if (!id) return null;
  const sheet = ensureMigoShopPurchasesSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0].map(h => String(h).trim());
  const nameCol = headers.indexOf('player_name');
  const reqCol = headers.indexOf('client_request_id');
  if (nameCol < 0 || reqCol < 0) return null;
  const name = normalizeMigoPlayerName_(playerName);
  for (let i = values.length - 1; i >= 1; i--) {
    if (normalizeMigoPlayerName_(values[i][nameCol]) !== name) continue;
    if (String(values[i][reqCol]).trim() !== id) continue;
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = values[i][index];
    });
    return record;
  }
  return null;
}

function buyMigoShopProduct_(ss, playerName, productId, clientRequestId) {
  const name = normalizeMigoPlayerName_(playerName);
  const cleanProductId = String(productId || '').trim();
  if (!name) throw new Error('プレイヤー名を入力してください');
  if (!cleanProductId) throw new Error('商品が指定されていません');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const existing = findMigoShopPurchaseByClientRequest_(ss, name, clientRequestId);
    if (existing) {
      const bal = getMigoBalance_(ss, name);
      return {
        ok: true,
        already_processed: true,
        purchase_id: String(existing.purchase_id || ''),
        product_id: String(existing.product_id || ''),
        product_name: String(existing.product_name || ''),
        price_paid: Math.max(0, Math.floor(Number(existing.price_paid) || 0)),
        balance: bal.balance,
        message: '同じ購入リクエストはすでに処理済みです'
      };
    }

    const found = findMigoShopProductRow_(ss, cleanProductId);
    if (!found || !found.product) throw new Error('商品が見つかりません');
    const product = found.product;
    if (product.deleted || !product.active) throw new Error('この商品は現在購入できません');
    if (product.stock < 1) throw new Error('在庫切れです');
    if (product.price < 1) throw new Error('商品価格が不正です');

    const bal = getMigoBalance_(ss, name);
    if (bal.balance < product.price) {
      throw new Error('ミゴコインが足りません（残高 ' + bal.balance + ' / 必要 ' + product.price + '）');
    }

    const spent = spendMigoCoins_(ss, name, product.price);
    const stockCol = found.headers.indexOf('stock') + 1;
    const updatedCol = found.headers.indexOf('updated_at') + 1;
    const nextStock = product.stock - 1;
    found.sheet.getRange(found.rowIndex, stockCol).setValue(nextStock);
    if (updatedCol > 0) found.sheet.getRange(found.rowIndex, updatedCol).setValue(new Date());

    const purchaseId = Utilities.getUuid();
    const now = new Date();
    const purchaseSheet = ensureMigoShopPurchasesSheet_(ss);
    purchaseSheet.appendRow([
      purchaseId,
      name,
      product.product_id,
      product.name,
      product.price,
      1,
      now,
      String(clientRequestId || '').trim()
    ]);

    return {
      ok: true,
      purchase_id: purchaseId,
      product_id: product.product_id,
      product_name: product.name,
      price_paid: product.price,
      qty: 1,
      stock: nextStock,
      balance: spent.balance,
      message: product.name + ' を購入しました'
    };
  } finally {
    lock.releaseLock();
  }
}

function getKpMigoShopSales_(ss) {
  const sheet = ensureMigoShopPurchasesSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { ok: true, sales: [] };
  const headers = values[0].map(h => String(h).trim());
  const sales = values.slice(1).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index];
    });
    const purchaseId = String(record.purchase_id || '').trim();
    if (!purchaseId) return null;
    return {
      purchase_id: purchaseId,
      player_name: String(record.player_name || '').trim(),
      product_id: String(record.product_id || '').trim(),
      product_name: String(record.product_name || '').trim(),
      price_paid: Math.max(0, Math.floor(Number(record.price_paid) || 0)),
      qty: Math.max(1, Math.floor(Number(record.qty) || 1)),
      purchased_at: record.purchased_at || ''
    };
  }).filter(Boolean);
  sales.reverse();
  return { ok: true, sales: sales };
}
