/**
 * Google Apps Script Webアプリ — スプレッドシート NPC データ取得
 * 失敗時は data/npcs.json にフォールバック（警告付き）
 */
window.AppsScriptProvider = {
  buildApiUrl(baseUrl, type) {
    const url = (baseUrl || '').trim();
    if (!url) throw new ArchiveLoadError('設定エラー', 'API baseUrl が未設定です');
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}type=${type}`;
  },

  buildNpcUrl(baseUrl) {
    return this.buildApiUrl(baseUrl, 'npcs');
  },

  buildOrganizationsUrl(baseUrl) {
    return this.buildApiUrl(baseUrl, 'organizations');
  },

  parseArrayJson(text, label) {
    const name = label || 'データ';
    const trimmed = (text || '').trim();
    if (!trimmed) {
      throw new ArchiveLoadError(
        'スプレッドシート API の応答が空です',
        'Apps Script が空のレスポンスを返しました。'
      );
    }
    if (trimmed.startsWith('<')) {
      throw new ArchiveLoadError(
        'スプレッドシート API の応答が不正です',
        'HTML が返されました。ウェブアプリの公開設定（アクセス: 全員）を確認してください。',
        { preview: trimmed.slice(0, 120) }
      );
    }
    try {
      const data = JSON.parse(trimmed);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.error === 'unknown type') {
          throw new ArchiveLoadError(
            'API 未対応のデータ種別',
            `API が type=${data.type || '?'} に未対応です。`,
            { unknownType: data.type || '', apiNotReady: true }
          );
        }
        throw new ArchiveLoadError(
          'スプレッドシート API の応答が不正です',
          `${name}は配列形式である必要があります。`,
          { receivedType: typeof data }
        );
      }
      return data;
    } catch (err) {
      if (err instanceof ArchiveLoadError) throw err;
      throw new ArchiveLoadError(
        'スプレッドシート API の応答が不正です',
        'JSON として解析できませんでした。',
        { cause: err.message, preview: trimmed.slice(0, 120) }
      );
    }
  },

  parseNpcJson(text) {
    return this.parseArrayJson(text, 'NPC データ');
  },

  parseOrganizationsJson(text) {
    return this.parseArrayJson(text, '組織データ');
  },

  parseScenariosJson(text) {
    return this.parseArrayJson(text, 'シナリオデータ');
  },

  fetchNpcsJsonp(url, timeoutMs = 30000, label = 'npcs') {
    return new Promise((resolve, reject) => {
      const callbackName = `_gasCb_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const separator = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      let timer;

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (data) => {
        cleanup();
        try {
          if (!Array.isArray(data)) {
            reject(new ArchiveLoadError(
              'スプレッドシート API の応答が不正です',
              'JSONP 応答が配列ではありません。'
            ));
            return;
          }
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };

      script.onerror = () => {
        cleanup();
        reject(new ArchiveLoadError(
          'スプレッドシート API（JSONP）に接続できません',
          'JSONP 読み込みに失敗しました。Apps Script に callback 対応が必要な場合があります。',
          { url }
        ));
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new ArchiveLoadError(
          'スプレッドシート API がタイムアウトしました',
          `${timeoutMs / 1000} 秒以内に応答がありませんでした。`,
          { url }
        ));
      }, timeoutMs);

      script.src = `${url}${separator}callback=${callbackName}`;
      document.head.appendChild(script);
    });
  },

  async fetchNpcsDirect(url, timeoutMs = 30000, parseFn) {
    const parse = parseFn || ((text) => this.parseNpcJson(text));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        signal: controller.signal
      });

      if (!res.ok) {
        throw new ArchiveLoadError(
          'スプレッドシート API がエラーを返しました',
          `HTTP ${res.status}: ${res.statusText}`,
          { url, status: res.status }
        );
      }

      const text = await res.text();
      return parse(text);
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ArchiveLoadError(
          'スプレッドシート API がタイムアウトしました',
          `${timeoutMs / 1000} 秒以内に応答がありませんでした。`,
          { url }
        );
      }
      if (err instanceof ArchiveLoadError) throw err;
      throw new ArchiveLoadError(
        'スプレッドシート API に接続できません',
        'ブラウザから API に接続できませんでした（CORS またはネットワークエラー）。',
        { url, cause: err.message }
      );
    } finally {
      clearTimeout(timer);
    }
  },

  async fetchArray(baseUrl, type, parseFn, errorTitle) {
    const url = this.buildApiUrl(baseUrl, type);
    const timeoutMs = window.AppConfig?.api?.timeoutMs || 30000;
    const parse = parseFn || ((text) => this.parseArrayJson(text));

    try {
      return await this.fetchNpcsDirect(url, timeoutMs, parse);
    } catch (fetchErr) {
      try {
        return await this.fetchNpcsJsonp(url, timeoutMs, type);
      } catch (jsonpErr) {
        throw new ArchiveLoadError(
          fetchErr.title || errorTitle,
          fetchErr.message,
          {
            url,
            fetch: { message: fetchErr.message, details: fetchErr.details },
            jsonp: { message: jsonpErr.message, details: jsonpErr.details },
            hint: 'Apps Script の doGet を docs/gas-npc-form.gs に合わせて再デプロイしてください。'
          }
        );
      }
    }
  },

  async fetchNpcs(baseUrl) {
    return this.fetchArray(
      baseUrl,
      'npcs',
      (text) => this.parseNpcJson(text),
      'スプレッドシートから NPC を取得できませんでした'
    );
  },

  async fetchOrganizations(baseUrl) {
    return this.fetchArray(
      baseUrl,
      'organizations',
      (text) => this.parseOrganizationsJson(text),
      'スプレッドシートから組織を取得できませんでした'
    );
  },

  async fetchScenarios(baseUrl) {
    return this.fetchArray(
      baseUrl,
      'scenarios',
      (text) => this.parseScenariosJson(text),
      'スプレッドシートからシナリオを取得できませんでした'
    );
  },

  async loadNpcsFromJson(jsonConfig) {
    const base = (jsonConfig?.basePath || 'data').replace(/\/$/, '');
    const url = `${base}/npcs.json`;
    let res;

    try {
      res = await fetch(url, { cache: 'no-store' });
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
  },

  mergeOrganizations(apiOrgs, jsonOrgs) {
    const map = new Map();
    (jsonOrgs || []).forEach(org => {
      if (org?.id) map.set(org.id, org);
    });
    (apiOrgs || []).forEach(org => {
      if (org?.id) map.set(org.id, org);
    });
    return [...map.values()];
  },

  async loadOrganizationsFromJson(jsonConfig) {
    const base = (jsonConfig?.basePath || 'data').replace(/\/$/, '');
    const url = `${base}/organizations.json`;
    let res;

    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (networkErr) {
      throw new ArchiveLoadError(
        'ローカル組織データに接続できません',
        `organizations.json を読み込めません（${url}）`,
        { url, cause: networkErr.message }
      );
    }

    if (!res.ok) {
      throw new ArchiveLoadError(
        'ローカル組織データの読み込みに失敗しました',
        `organizations.json — HTTP ${res.status}`,
        { url, status: res.status }
      );
    }

    const data = await res.json();
    return data.organizations || [];
  },

  async loadOrganizations(apiConfig, jsonConfig) {
    if (!apiConfig?.baseUrl) {
      const organizations = await this.loadOrganizationsFromJson(jsonConfig);
      return {
        organizations,
        source: 'json',
        notice: {
          level: 'warning',
          title: 'API 未設定',
          message: 'スプレッドシート API URL が未設定のため、ローカル JSON（organizations.json）を表示しています。'
        }
      };
    }

    try {
      const apiOrgs = await this.fetchOrganizations(apiConfig.baseUrl);
      let jsonOrgs = [];
      try {
        jsonOrgs = await this.loadOrganizationsFromJson(jsonConfig);
      } catch (_) {
        jsonOrgs = [];
      }

      const organizations = this.mergeOrganizations(apiOrgs, jsonOrgs);
      let notice = null;
      if (apiOrgs.length === 0) {
        notice = {
          level: 'warning',
          title: '組織データなし',
          message: 'スプレッドシートに組織が登録されていません。'
        };
      }

      return {
        organizations,
        source: apiOrgs.length ? 'api' : 'json',
        notice
      };
    } catch (apiErr) {
      try {
        const organizations = await this.loadOrganizationsFromJson(jsonConfig);
        return {
          organizations,
          source: 'json-fallback',
          notice: {
            level: 'error',
            title: apiErr.title || 'スプレッドシートから組織を取得できませんでした',
            message: apiErr.message,
            details: apiErr.details || {},
            fallback: `ローカル JSON（organizations.json）の ${organizations.length} 件を表示しています。`
          }
        };
      } catch (jsonErr) {
        throw new ArchiveLoadError(
          '組織データを読み込めません',
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
  },

  mergeScenarios(apiScenarios, jsonScenarios) {
    const map = new Map();
    (jsonScenarios || []).forEach(sc => {
      if (sc?.id) map.set(sc.id, sc);
    });
    (apiScenarios || []).forEach(sc => {
      if (sc?.id) map.set(sc.id, sc);
    });
    return [...map.values()];
  },

  async loadScenariosFromJson(jsonConfig) {
    const base = (jsonConfig?.basePath || 'data').replace(/\/$/, '');
    const url = `${base}/scenarios.json`;
    let res;

    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (networkErr) {
      throw new ArchiveLoadError(
        'ローカルシナリオデータに接続できません',
        `scenarios.json を読み込めません（${url}）`,
        { url, cause: networkErr.message }
      );
    }

    if (!res.ok) {
      throw new ArchiveLoadError(
        'ローカルシナリオデータの読み込みに失敗しました',
        `scenarios.json — HTTP ${res.status}`,
        { url, status: res.status }
      );
    }

    const data = await res.json();
    return data.scenarios || [];
  },

  async loadScenarios(apiConfig, jsonConfig) {
    if (!apiConfig?.baseUrl) {
      const scenarios = await this.loadScenariosFromJson(jsonConfig);
      return {
        scenarios,
        source: 'json',
        notice: {
          level: 'warning',
          title: 'API 未設定',
          message: 'スプレッドシート API URL が未設定のため、ローカル JSON（scenarios.json）を表示しています。'
        }
      };
    }

    try {
      const apiScenarios = await this.fetchScenarios(apiConfig.baseUrl);
      let jsonScenarios = [];
      try {
        jsonScenarios = await this.loadScenariosFromJson(jsonConfig);
      } catch (_) {
        jsonScenarios = [];
      }

      const scenarios = this.mergeScenarios(apiScenarios, jsonScenarios);
      let notice = null;
      if (apiScenarios.length === 0) {
        notice = {
          level: 'warning',
          title: 'シナリオデータなし',
          message: 'スプレッドシートにシナリオが登録されていません。'
        };
      }

      return {
        scenarios,
        source: apiScenarios.length ? 'api' : 'json',
        notice
      };
    } catch (apiErr) {
      try {
        const scenarios = await this.loadScenariosFromJson(jsonConfig);
        if (apiErr.details?.apiNotReady && apiErr.details?.unknownType === 'scenarios') {
          return { scenarios, source: 'json', notice: null };
        }
        return {
          scenarios,
          source: 'json-fallback',
          notice: {
            level: 'error',
            title: apiErr.title || 'スプレッドシートからシナリオを取得できませんでした',
            message: apiErr.message,
            details: apiErr.details || {},
            fallback: `ローカル JSON（scenarios.json）の ${scenarios.length} 件を表示しています。`
          }
        };
      } catch (jsonErr) {
        throw new ArchiveLoadError(
          'シナリオデータを読み込めません',
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
