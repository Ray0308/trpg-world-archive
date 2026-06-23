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
    organizationForm: '#', // 組織フォーム作成後に URL を設定（docs/organization-form-setup.md）
    scenarioForm: '#',
    pcForm: '#',

    /** 外部ツール・コミュニティ（# は未設定） */
    cocofolia: 'https://ccfolia.com/',
    iachara: 'https://iachara.com/',
    discord: 'https://discord.com/channels/1420377314264485950/1420377315082502228'
  };
})();
