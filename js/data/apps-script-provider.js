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

  parseNpcJson(text) {
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
      if (!Array.isArray(data)) {
        throw new ArchiveLoadError(
          'スプレッドシート API の応答が不正です',
          'NPC データは配列形式である必要があります。',
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

  fetchNpcsJsonp(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const callbackName = `_gasNpcCb_${Date.now()}`;
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

  async fetchNpcsDirect(url, timeoutMs = 30000) {
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
      return this.parseNpcJson(text);
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

  async fetchNpcs(baseUrl) {
    const url = this.buildNpcUrl(baseUrl);
    const timeoutMs = window.AppConfig?.api?.timeoutMs || 30000;

    try {
      return await this.fetchNpcsDirect(url, timeoutMs);
    } catch (fetchErr) {
      try {
        const data = await this.fetchNpcsJsonp(url, timeoutMs);
        return data;
      } catch (jsonpErr) {
        throw new ArchiveLoadError(
          fetchErr.title || 'スプレッドシートから NPC を取得できませんでした',
          fetchErr.message,
          {
            url,
            fetch: { message: fetchErr.message, details: fetchErr.details },
            jsonp: { message: jsonpErr.message, details: jsonpErr.details },
            hint: 'Apps Script の doGet に callback パラメータ対応を追加してください（docs/gas-doget.md 参照）。'
          }
        );
      }
    }
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
  }
};
