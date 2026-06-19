/**
 * TRPG World Archive — アプリ設定
 * GitHub Pages（/trpg-world-archive/）でもローカルでも動作するようパスを自動解決
 */
(function () {
  function getAppRoot() {
    let path = window.location.pathname;
    if (path.endsWith('index.html') || path.endsWith('kp.html')) {
      path = path.replace(/[^/]+$/, '');
    }
    if (!path.endsWith('/')) {
      const slash = path.lastIndexOf('/');
      path = slash >= 0 ? path.slice(0, slash + 1) : '/';
    }
    return path;
  }

  const appRoot = getAppRoot();

  window.AppConfig = {
    appRoot,

    /** Google Apps Script Webアプリ（スプレッドシート → JSON） */
    api: {
      baseUrl: 'https://script.google.com/macros/s/AKfycbzpuz_aIieBUVLJye3RLmWsBJt6bbfOqaZaxRlqrhHWxcneXCupPergOHY9bDsmo_n2/exec'
    },

    /** ローカル JSON（NPC フォールバック + 組織・シナリオ・PC） */
    json: {
      basePath: appRoot + 'data'
    }
  };
})();
