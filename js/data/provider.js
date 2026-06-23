/**
 * データ取得の統一入口
 * NPC・組織: スプレッドシート（Apps Script API）→ 失敗時 JSON
 * その他: ローカル JSON
 */
window.loadArchiveData = async function loadArchiveData() {
  const jsonConfig = window.AppConfig?.json || { basePath: 'data' };
  const apiConfig = window.AppConfig?.api;

  const [jsonData, npcResult, orgResult] = await Promise.all([
    window.JsonDataProvider.load(jsonConfig),
    window.AppsScriptProvider.loadNpcs(apiConfig, jsonConfig),
    window.AppsScriptProvider.loadOrganizations(apiConfig, jsonConfig)
  ]);

  const notices = [];
  if (npcResult.notice) notices.push(npcResult.notice);
  if (orgResult.notice) notices.push(orgResult.notice);

  const raw = {
    ...jsonData,
    npcs: npcResult.npcs,
    organizations: orgResult.organizations
  };

  const data = window.ArchiveNormalize.normalizeArchiveData(raw);
  const indexes = window.ArchiveNormalize.buildIndexes(data);

  return {
    data,
    indexes,
    meta: {
      npcSource: npcResult.source,
      orgSource: orgResult.source,
      notices
    }
  };
};
