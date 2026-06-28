/**
 * 外部リンク定数（フォーム URL 等）
 * スプレッドシート URL・GAS 管理 URL は含めない
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

  window.AppLinks = {
    publicSite: 'https://ray0308.github.io/trpg-world-archive/',
    plIndex: appRoot + 'index.html',
    kpPage: appRoot + 'kp.html',
    npcForm: 'https://docs.google.com/forms/d/e/1FAIpQLSfscXkMnmrSczHr957jNrwon1ZGDQixceyAOmJx26xGQ1Zucw/viewform',
    organizationForm: 'https://docs.google.com/forms/d/e/1FAIpQLSdOio3knxLlXFAPz8TWeq-Yjsy-N2xjMkHyySjJC7KOxUN3zA/viewform',
    scenarioForm: 'https://docs.google.com/forms/d/e/1FAIpQLSeuLPqiYqKwr7kHQ2y-BU8QT9kAO5rqi2HZsNDS9LOSaJzOZg/viewform',
    pcForm: 'https://docs.google.com/forms/d/e/1FAIpQLSdijWFqVuaMmtu7ORESIks_f5QkNtvhRyk84LcBL7BkNyfhWg/viewform',

    /** PL/KP 共通 — 配布資料の Google ドライブフォルダ（リンクを知っている人が閲覧できる共有設定にすること） */
    filesDriveFolder: 'https://drive.google.com/drive/folders/1Wh-1nA_FKheUc9V3DdmbcWTVnlfzVfAb?usp=sharing',

    /** 外部ツール・コミュニティ（# は未設定） */
    cocofolia: 'https://ccfolia.com/',
    iachara: 'https://iachara.com/',
    discord: 'https://discord.com/channels/1420377314264485950/1420377315082502228'
  };
})();
