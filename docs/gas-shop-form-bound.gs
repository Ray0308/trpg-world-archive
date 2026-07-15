/**
 * YOKOFOLIA — マリウスの露天商 商品登録フォーム用（SHOP PJ）
 *
 *   DBPJ    … スプレッドシート（TRPG World Archive DB）
 *   NPCPJ   … docs/gas-npc-form.gs（公開 API / 購入処理）
 *   SHOP PJ … このファイル（フォーム送信 → MIGO_SHOP_PRODUCTS 転記）
 *
 * セットアップ:
 * 1. 商品登録フォーム → ⋮ → スクリプトエディタ
 * 2. この内容を Code.gs に貼り付けて保存
 * 3. トリガー → onShopFormSubmit / フォームから / 送信時
 * 4. 回答の送り先を DBPJ のスプレッドシートに設定
 * 5. NPCPJ（gas-npc-form.gs）を再デプロイ（ショップ API）
 *
 * フォーム項目（推奨タイトル）:
 *  - 商品名（必須）
 *  - 商品説明
 *  - 商品画像（ファイル）
 *  - 価格（整数・必須）
 *  - 在庫数（整数・必須）
 *  - 備考（任意・KP用）
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

function pickRawAnswer_(answers, ...keys) {
  for (const key of keys) {
    if (answers[key] != null && answers[key] !== '') return answers[key];
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
  throw new Error('フォームを取得できません（SHOP PJ＝商品フォームに紐づけてください）');
}

function getSpreadsheetFromEvent_(e) {
  const form = getFormFromEvent_(e);
  return SpreadsheetApp.openById(form.getDestinationId());
}

function getShopProductHeaders_() {
  return [
    'product_id',
    'name',
    'description',
    'image_url',
    'price',
    'stock',
    'active',
    'sort_order',
    'deleted',
    'edit_url',
    'form_response_id',
    'created_at',
    'updated_at',
    'memo'
  ];
}

function ensureShopProductHeader_(sheet) {
  const headers = getShopProductHeaders_();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const isEmpty = firstRow.every(value => value === '');

  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
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

function generateShopProductId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'shop_001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNumber = 0;
  ids.forEach(id => {
    const match = String(id).match(/^shop_(\d+)$/i);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });
  return 'shop_' + String(maxNumber + 1).padStart(3, '0');
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

function parseNonNegInt_(value, fallback) {
  const n = Math.floor(Number(String(value || '').replace(/[^\d.-]/g, '')));
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

function isShopResponseAlreadyImported_(sheet, formResponseId) {
  const headers = readSheetHeaders_(sheet);
  const idx = headers.indexOf('form_response_id');
  if (idx < 0) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().flat();
  return values.some(v => String(v).trim() === String(formResponseId).trim());
}

function findShopRowByFormResponseId_(sheet, formResponseId) {
  const headers = readSheetHeaders_(sheet);
  const idx = headers.indexOf('form_response_id');
  if (idx < 0) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][idx] || '').trim() === String(formResponseId).trim()) {
      return { rowIndex: i + 2, headers: headers, values: values[i] };
    }
  }
  return null;
}

function buildShopRowFromAnswers_(answers, sheet, meta) {
  const now = new Date();
  const m = meta || {};
  const response = m.response;
  const price = parseNonNegInt_(pickAnswer_(answers, '価格', '価格（菌糸コイン）'), -1);
  const stock = parseNonNegInt_(pickAnswer_(answers, '在庫数', '在庫'), -1);

  return {
    product_id: generateShopProductId_(sheet),
    name: pickAnswer_(answers, '商品名'),
    description: pickAnswer_(answers, '商品説明', '説明'),
    image_url: normalizeImageUrl_(
      pickRawAnswer_(answers, '商品画像', '画像', '画像URL')
    ),
    price: price,
    stock: stock,
    active: true,
    sort_order: 100,
    deleted: '',
    edit_url: m.editUrl || (response && typeof response.getEditResponseUrl === 'function'
      ? response.getEditResponseUrl() : ''),
    form_response_id: m.formResponseId || (response && typeof response.getId === 'function'
      ? response.getId() : ''),
    created_at: now,
    updated_at: now,
    memo: pickAnswer_(answers, '備考', 'メモ')
  };
}

function writeShopRow_(sheet, headers, rowData, rowIndex) {
  const line = headers.map(h => (rowData[h] !== undefined ? rowData[h] : ''));
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([line]);
}

function appendOrUpdateShopFromAnswers_(ss, answers, meta) {
  const sheet = getOrCreateSheet_(ss, 'MIGO_SHOP_PRODUCTS');
  const headers = ensureShopProductHeader_(sheet);
  const rowData = buildShopRowFromAnswers_(answers, sheet, meta);

  if (!String(rowData.name || '').trim()) {
    Logger.log('Shop skip: 商品名が空');
    return null;
  }
  if (rowData.price < 1) {
    Logger.log('Shop skip: 価格が不正');
    return null;
  }
  if (rowData.stock < 0) {
    Logger.log('Shop skip: 在庫が不正');
    return null;
  }

  if (rowData.form_response_id) {
    const existing = findShopRowByFormResponseId_(sheet, rowData.form_response_id);
    if (existing) {
      const idIdx = existing.headers.indexOf('product_id');
      const createdIdx = existing.headers.indexOf('created_at');
      const stockIdx = existing.headers.indexOf('stock');
      const activeIdx = existing.headers.indexOf('active');
      const deletedIdx = existing.headers.indexOf('deleted');
      rowData.product_id = String(existing.values[idIdx] || rowData.product_id);
      if (createdIdx >= 0) rowData.created_at = existing.values[createdIdx];
      // 在庫・公開・削除・表示順は KP / 既存値を優先して上書きしない
      const sortIdx = existing.headers.indexOf('sort_order');
      if (stockIdx >= 0) rowData.stock = existing.values[stockIdx];
      if (activeIdx >= 0) rowData.active = existing.values[activeIdx];
      if (deletedIdx >= 0) rowData.deleted = existing.values[deletedIdx];
      if (sortIdx >= 0) rowData.sort_order = existing.values[sortIdx];
      rowData.updated_at = new Date();
      writeShopRow_(sheet, headers, rowData, existing.rowIndex);
      Logger.log('Shop updated: ' + rowData.product_id);
      return rowData;
    }
  }

  writeShopRow_(sheet, headers, rowData, sheet.getLastRow() + 1);
  Logger.log('Shop added: ' + rowData.product_id);
  return rowData;
}

function onShopFormSubmit(e) {
  const response = e && e.response;
  if (!response) throw new Error('フォーム回答がありません');
  const ss = getSpreadsheetFromEvent_(e);
  const answers = getAnswers_(response);
  appendOrUpdateShopFromAnswers_(ss, answers, {
    response: response,
    formResponseId: response.getId(),
    editUrl: response.getEditResponseUrl()
  });
}

/** 既存回答の一括取込（手動実行） */
function importAllShopResponses() {
  const form = FormApp.getActiveForm();
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const responses = form.getResponses();
  let imported = 0;
  responses.forEach(response => {
    const answers = getAnswers_(response);
    const result = appendOrUpdateShopFromAnswers_(ss, answers, {
      response: response,
      formResponseId: response.getId(),
      editUrl: response.getEditResponseUrl()
    });
    if (result) imported += 1;
  });
  const msg = 'Shop import done: ' + imported + ' / ' + responses.length;
  Logger.log(msg);
  return msg;
}
