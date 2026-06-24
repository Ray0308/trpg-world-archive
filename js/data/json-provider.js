/**
 * ローカル JSON — 組織・シナリオ・PC（NPC フォールバック用にも使用）
 */
window.JsonDataProvider = {
  async fetchJson(base, file) {
    const url = `${base}/${file}`;
    let res;
    try {
      res = await fetch(url);
    } catch (networkErr) {
      throw new ArchiveLoadError(
        `${file} に接続できません`,
        `ネットワークエラー（${url}）`,
        { url, cause: networkErr.message }
      );
    }
    if (!res.ok) {
      throw new ArchiveLoadError(
        `${file} の読み込みに失敗しました`,
        `HTTP ${res.status}: ${res.statusText}`,
        { url, status: res.status }
      );
    }
    try {
      return await res.json();
    } catch (parseErr) {
      throw new ArchiveLoadError(
        `${file} の形式が不正です`,
        'JSON として解析できませんでした。',
        { url, cause: parseErr.message }
      );
    }
  },

  async load(config) {
    const base = (config?.basePath || 'data').replace(/\/$/, '');
    const [npcs, organizations, scenarios, pcs, locations, files] = await Promise.all([
      this.fetchJson(base, 'npcs.json'),
      this.fetchJson(base, 'organizations.json'),
      this.fetchJson(base, 'scenarios.json'),
      this.fetchJson(base, 'pcs.json'),
      this.fetchJson(base, 'locations.json'),
      this.fetchJson(base, 'files.json').catch(() => ({ files: [] }))
    ]);

    return {
      npcs: npcs.npcs || [],
      organizations: organizations.organizations || [],
      scenarios: scenarios.scenarios || [],
      pcs: pcs.pcs || [],
      locations: locations.locations || [],
      files: files.files || []
    };
  }
};
