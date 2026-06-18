/**
 * データ取得の統一入口
 * NPC: スプレッドシート（Apps Script API）→ 失敗時 npcs.json
 * その他: ローカル JSON
 */
window.loadArchiveData = async function loadArchiveData() {
  const jsonConfig = window.AppConfig?.json || { basePath: 'data' };
  const apiConfig = window.AppConfig?.api;

  const jsonData = await window.JsonDataProvider.load(jsonConfig);
  const npcResult = await window.AppsScriptProvider.loadNpcs(apiConfig, jsonConfig);

  const notices = [];
  if (npcResult.notice) notices.push(npcResult.notice);

  const raw = {
    ...jsonData,
    npcs: npcResult.npcs
  };

  const data = window.ArchiveNormalize.normalizeArchiveData(raw);
  const indexes = window.ArchiveNormalize.buildIndexes(data);

  return {
    data,
    indexes,
    meta: {
      npcSource: npcResult.source,
      notices
    }
  };
};
