/**
 * Google Apps Script Webアプリ — スプレッドシート NPC データ取得
 * 失敗時は data/npcs.json にフォールバック（警告付き）
 */
window.AppsScriptProvider = {
  buildNpcUrl(baseUrl) {
    const url = (baseUrl || '').trim();
    if (!url) throw new ArchiveLoadError('設定エラー', 'API baseUrl が未設定です');
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}type=npcs`;
  },

  async fetchNpcs(baseUrl) {
    const url = this.buildNpcUrl(baseUrl);
    let res;

    try {
      res = await fetch(url);
    } catch (networkErr) {
      throw new ArchiveLoadError(
        'スプレッドシート API に接続できません',
        'ネットワークエラーが発生しました。インターネット接続と API URL を確認してください。',
        { url, cause: networkErr.message }
      );
    }

    if (!res.ok) {
      throw new ArchiveLoadError(
        'スプレッドシート API がエラーを返しました',
        `HTTP ${res.status}: ${res.statusText}`,
        { url, status: res.status }
      );
    }

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new ArchiveLoadError(
        'スプレッドシート API の応答が不正です',
        'JSON として解析できませんでした。Apps Script の出力形式を確認してください。',
        { url, cause: parseErr.message }
      );
    }

    if (!Array.isArray(data)) {
      throw new ArchiveLoadError(
        'スプレッドシート API の応答が不正です',
        'NPC データは配列形式である必要があります。',
        { url, receivedType: typeof data }
      );
    }

    return data;
  },

  async loadNpcsFromJson(jsonConfig) {
    const base = (jsonConfig?.basePath || 'data').replace(/\/$/, '');
    const url = `${base}/npcs.json`;
    let res;

    try {
      res = await fetch(url);
    } catch (networkErr) {
      throw new ArchiveLoadError(
        'ローカル NPC データに接続できません',
        `npcs.json を読み込めません（${url}）`,
        { url, cause: networkErr.message }
      );
    }

    if (!res.ok) {
      throw new ArchiveLoadError(
        'ローカル NPC データの読み込みに失敗しました',
        `npcs.json — HTTP ${res.status}`,
        { url, status: res.status }
      );
    }

    const data = await res.json();
    return data.npcs || [];
  },

  /**
   * @returns {{ npcs: Array, source: string, notice: object|null }}
   */
  async loadNpcs(apiConfig, jsonConfig) {
    if (!apiConfig?.baseUrl) {
      const npcs = await this.loadNpcsFromJson(jsonConfig);
      return {
        npcs,
        source: 'json',
        notice: {
          level: 'warning',
          title: 'API 未設定',
          message: 'スプレッドシート API URL が未設定のため、ローカル JSON（npcs.json）を表示しています。'
        }
      };
    }

    try {
      const npcs = await this.fetchNpcs(apiConfig.baseUrl);
      const notice = npcs.length === 0
        ? {
            level: 'warning',
            title: 'NPC データなし',
            message: 'スプレッドシートに NPC が登録されていません。'
          }
        : null;

      return { npcs, source: 'api', notice };
    } catch (apiErr) {
      try {
        const npcs = await this.loadNpcsFromJson(jsonConfig);
        return {
          npcs,
          source: 'json-fallback',
          notice: {
            level: 'error',
            title: apiErr.title || 'スプレッドシートから NPC を取得できませんでした',
            message: apiErr.message,
            details: apiErr.details || {},
            fallback: `ローカル JSON（npcs.json）の ${npcs.length} 件を表示しています。`
          }
        };
      } catch (jsonErr) {
        throw new ArchiveLoadError(
          'NPC データを読み込めません',
          'スプレッドシート API とローカル JSON の両方から取得に失敗しました。',
          {
            api: {
              title: apiErr.title,
              message: apiErr.message,
              details: apiErr.details
            },
            json: {
              title: jsonErr.title,
              message: jsonErr.message,
              details: jsonErr.details
            }
          }
        );
      }
    }
  }
};
