/**
 * KP入力ページ — フォームリンク集 + 編集ピッカー / 一覧 / PL表示設定
 */
(function () {
  const ENTITY_DEFS = {
    npc: {
      linkKey: 'npcForm',
      icon: '🧑‍🤝‍🧑',
      name: 'NPC登録フォーム',
      description: 'NPCの名前、画像、人物紹介、エピソード、関連情報を登録するフォーム。',
      apiType: 'npcs',
      visibilityApiType: 'npc-visibility',
      pickerTitle: 'NPCを編集',
      listTitle: 'NPC一覧（KP用）',
      visibilityTitle: 'PLサイトの表示設定（NPC）',
      listHint: '非表示の NPC も含めてすべて表示します。PLサイトに出すかどうかは「表示設定」で変更できます。',
      visibilityHint: 'オフにした NPC は PL サイト（閲覧ページ）に表示されません。',
      pickerSearchPlaceholder: '名前・ふりがなで検索...',
      listSearchPlaceholder: '名前・ふりがな・職業で検索...',
      visibilitySearchPlaceholder: '名前・ふりがなで検索...',
      plSection: 'npcs',
      emptyLabel: 'NPC',
      editable: true,
      visibilityControl: true
    },
    org: {
      linkKey: 'organizationForm',
      icon: '🏛️',
      name: '組織登録フォーム',
      description: '組織の名称、説明、所在地、概要、所属NPCを登録するフォーム。',
      apiType: 'organizations',
      visibilityApiType: 'org-visibility',
      pickerTitle: '組織を編集',
      listTitle: '組織一覧（KP用）',
      visibilityTitle: 'PLサイトの表示設定（組織）',
      listHint: '非表示の組織も含めてすべて表示します。PLサイトに出すかどうかは「表示設定」で変更できます。',
      visibilityHint: 'オフにした組織は PL サイト（閲覧ページ）に表示されません。',
      pickerSearchPlaceholder: '組織名・概要で検索...',
      listSearchPlaceholder: '組織名・概要で検索...',
      visibilitySearchPlaceholder: '組織名・概要で検索...',
      plSection: 'organizations',
      emptyLabel: '組織',
      editable: true,
      visibilityControl: true
    },
    scenario: {
      linkKey: 'scenarioForm',
      icon: '📜',
      name: 'シナリオ登録フォーム',
      description: 'シナリオの名称、概要、年代、関連情報を登録するフォーム。'
    },
    pc: {
      linkKey: 'pcForm',
      icon: '👤',
      name: 'PC登録フォーム',
      description: 'PCの名前、プレイヤー名、説明、関連NPCを登録するフォーム。'
    }
  };

  const FORM_CARDS = ['npc', 'org', 'scenario', 'pc'];

  const EXTERNAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>';

  const entityCache = { npc: null, org: null };
  const entityLoadError = { npc: null, org: null };
  let activeEntity = 'npc';
  let listFilter = 'all';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function getEntityDef(entity) {
    return ENTITY_DEFS[entity];
  }

  function buildApiUrl(apiType, { kp = false } = {}) {
    const base = window.AppConfig?.api?.baseUrl || '';
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}type=${encodeURIComponent(apiType)}${kp ? '&kp=1' : ''}`;
  }

  function buildVisibilityApiUrl(entity, itemId, hidden) {
    const def = getEntityDef(entity);
    const base = window.AppConfig?.api?.baseUrl || '';
    if (!base || !def?.visibilityApiType) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}type=${encodeURIComponent(def.visibilityApiType)}&id=${encodeURIComponent(itemId)}&hidden=${hidden ? '1' : '0'}`;
  }

  function invalidateEntityCache(entity) {
    entityCache[entity] = null;
    entityLoadError[entity] = null;
  }

  function fetchJsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = `_kpCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(reject, new Error('タイムアウト')), 30000);

      function cleanup(rej, err) {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
        if (rej && err) rej(err);
      }

      window[cb] = (data) => {
        cleanup(null);
        if (!Array.isArray(data)) {
          reject(new Error('一覧の形式が不正です'));
          return;
        }
        resolve(data);
      };

      script.onerror = () => cleanup(reject, new Error('一覧の取得に失敗しました'));
      script.src = `${url}&callback=${cb}`;
      document.head.appendChild(script);
    });
  }

  async function fetchEntityArray(url) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = JSON.parse(await res.text());
      if (!Array.isArray(data)) throw new Error('配列ではありません');
      return data;
    } catch (err) {
      return fetchJsonp(url);
    }
  }

  function mergeNpcImages(kpItems, publicItems) {
    const imageById = new Map(
      (publicItems || []).map(item => [item.id, item.image_url || item.imageUrl || item.image || ''])
    );
    return kpItems.map(item => ({
      ...item,
      image_url: item.image_url || imageById.get(item.id) || '',
      pl_hidden: Boolean(item.pl_hidden)
    }));
  }

  function mergeOrgIcons(kpItems, publicItems) {
    const iconById = new Map(
      (publicItems || []).map(item => [item.id, item.icon || '🏛️'])
    );
    return kpItems.map(item => ({
      ...item,
      icon: item.icon || iconById.get(item.id) || '🏛️',
      pl_hidden: Boolean(item.pl_hidden)
    }));
  }

  async function setEntityPlHidden(entity, itemId, hidden) {
    const url = buildVisibilityApiUrl(entity, itemId, hidden);
    if (!url) throw new Error('API URL が未設定です（js/config.js）');

    const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error === 'unknown type') {
      throw new Error(
        'APIが古いバージョンです。\n' +
        'NPCPJ の GAS（docs/gas-npc-form.gs）を貼り直し、' +
        'ウェブアプリを「新バージョン」で再デプロイしてください。'
      );
    }
    if (data.error) throw new Error(data.error);
    if (!data.ok) throw new Error('更新に失敗しました');

    invalidateEntityCache(entity);
    return data;
  }

  async function loadApiCapabilities() {
    const base = window.AppConfig?.api?.baseUrl || '';
    if (!base) return [];
    try {
      const res = await fetch(`${base}${base.includes('?') ? '&' : '?'}type=version`, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.capabilities) ? data.capabilities : [];
    } catch (_) {
      return [];
    }
  }

  async function ensureVisibilityApi(entity) {
    const def = getEntityDef(entity);
    const caps = await loadApiCapabilities();
    if (caps.length && !caps.includes(def.visibilityApiType)) {
      throw new Error(
        `APIに ${def.visibilityApiType} がありません。\n` +
        'NPCPJ の GAS を最新にしてウェブアプリを再デプロイしてください。'
      );
    }
  }

  async function loadKpEntities(entity) {
    if (entityCache[entity]) return entityCache[entity];
    if (entityLoadError[entity]) throw entityLoadError[entity];

    const def = getEntityDef(entity);
    const kpUrl = buildApiUrl(def.apiType, { kp: true });
    const publicUrl = buildApiUrl(def.apiType, { kp: false });
    if (!kpUrl) {
      entityLoadError[entity] = new Error('API URL が未設定です（js/config.js）');
      throw entityLoadError[entity];
    }

    try {
      const [kpItems, publicItems] = await Promise.all([
        fetchEntityArray(kpUrl),
        fetchEntityArray(publicUrl).catch(() => [])
      ]);
      entityCache[entity] = entity === 'npc'
        ? mergeNpcImages(kpItems, publicItems)
        : mergeOrgIcons(kpItems, publicItems);
      return entityCache[entity];
    } catch (err) {
      entityLoadError[entity] = err;
      throw err;
    }
  }

  function renderCardActions(entity, url, isReady) {
    const def = getEntityDef(entity);
    if (!isReady) {
      return `<span class="kp-card-btn kp-card-btn--disabled" aria-disabled="true">準備中</span>`;
    }

    const newBtn = `<a href="${escapeAttr(url)}" class="kp-card-btn" target="_blank" rel="noopener noreferrer">新規登録${EXTERNAL_ICON}</a>`;

    if (!def.editable) {
      return `<div class="kp-card-actions">${newBtn}</div>`;
    }

    return `
      <div class="kp-card-actions">
        ${newBtn}
        <button type="button" class="kp-card-btn kp-card-btn--secondary" data-kp-edit="${escapeAttr(entity)}">編集</button>
        <button type="button" class="kp-card-btn kp-card-btn--secondary" data-kp-list="${escapeAttr(entity)}">一覧</button>
        <button type="button" class="kp-card-btn kp-card-btn--secondary" data-kp-visibility="${escapeAttr(entity)}">表示設定</button>
      </div>
    `;
  }

  function renderCards() {
    const grid = document.getElementById('kpCardGrid');
    const links = window.AppLinks || {};

    grid.innerHTML = FORM_CARDS.map(entity => {
      const def = getEntityDef(entity);
      const url = links[def.linkKey] || '#';
      const isReady = url && url !== '#';

      return `
        <article class="kp-card">
          <span class="kp-card-icon">${def.icon}</span>
          <h2 class="kp-card-name">${escapeHtml(def.name)}</h2>
          <p class="kp-card-desc">${escapeHtml(def.description)}</p>
          ${renderCardActions(entity, url, isReady)}
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-kp-edit]').forEach(btn => {
      btn.addEventListener('click', () => openPicker(btn.dataset.kpEdit));
    });
    grid.querySelectorAll('[data-kp-list]').forEach(btn => {
      btn.addEventListener('click', () => openList(btn.dataset.kpList));
    });
    grid.querySelectorAll('[data-kp-visibility]').forEach(btn => {
      btn.addEventListener('click', () => openVisibility(btn.dataset.kpVisibility));
    });
  }

  function statusBadgeClass(status) {
    const map = {
      '生存': 'status-alive',
      '死亡': 'status-dead',
      '行方不明': 'status-missing',
      '不明': 'status-unknown'
    };
    return map[String(status).trim()] || 'status-unknown';
  }

  function generatePickerAvatarFallback(name) {
    const initial = (name || '?').charAt(0);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="8" fill="#2d5a3d"/>
      <circle cx="40" cy="32" r="14" fill="#4a9eff" opacity="0.6"/>
      <ellipse cx="40" cy="68" rx="22" ry="16" fill="#4a9eff" opacity="0.4"/>
      <text x="40" y="36" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="600">${initial}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  window.handleArchiveImgError = window.handleArchiveImgError || function (img) {
    let fallbacks = [];
    try {
      const raw = img.getAttribute('data-fallbacks') || '%5B%5D';
      fallbacks = JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      fallbacks = [];
    }
    if (fallbacks.length > 0) {
      img.src = fallbacks.shift();
      img.setAttribute('data-fallbacks', encodeURIComponent(JSON.stringify(fallbacks)));
      return;
    }
    img.onerror = null;
    const emoji = img.getAttribute('data-emoji-fallback');
    if (emoji) {
      const span = document.createElement('span');
      span.className = img.className.replace('kp-picker-avatar', 'kp-picker-icon-emoji');
      span.textContent = emoji;
      span.setAttribute('aria-hidden', 'true');
      img.replaceWith(span);
      return;
    }
    try {
      const svg = decodeURIComponent(img.getAttribute('data-svg-fallback') || '');
      if (svg) img.src = svg;
    } catch (e) {
      /* ignore */
    }
  };

  function renderNpcThumb(npc) {
    const svgFallback = generatePickerAvatarFallback(npc.name);
    const url = npc.image_url || '';
    const utils = window.ImageUtils;
    const { src, fallbacks } = utils
      ? utils.buildImgAttrs(url, svgFallback)
      : { src: url || svgFallback, fallbacks: [] };

    return `<img class="kp-picker-avatar"` +
      ` src="${escapeAttr(src)}"` +
      ` alt=""` +
      ` loading="lazy"` +
      ` decoding="async"` +
      ` referrerpolicy="no-referrer"` +
      ` data-fallbacks="${encodeURIComponent(JSON.stringify(fallbacks))}"` +
      ` data-svg-fallback="${encodeURIComponent(svgFallback)}"` +
      ` onerror="handleArchiveImgError(this)">`;
  }

  function renderOrgThumb(org) {
    const icon = String(org.icon || '🏛️').trim();
    if (/^https?:\/\//i.test(icon)) {
      const svgFallback = generatePickerAvatarFallback(org.name);
      const utils = window.ImageUtils;
      const { src, fallbacks } = utils
        ? utils.buildImgAttrs(icon, svgFallback)
        : { src: icon, fallbacks: [] };
      return `<img class="kp-picker-avatar"` +
        ` src="${escapeAttr(src)}"` +
        ` alt=""` +
        ` loading="lazy"` +
        ` decoding="async"` +
        ` referrerpolicy="no-referrer"` +
        ` data-fallbacks="${encodeURIComponent(JSON.stringify(fallbacks))}"` +
        ` data-emoji-fallback="🏛️"` +
        ` data-svg-fallback="${encodeURIComponent(svgFallback)}"` +
        ` onerror="handleArchiveImgError(this)">`;
    }
    return `<span class="kp-picker-icon-emoji" aria-hidden="true">${escapeHtml(icon || '🏛️')}</span>`;
  }

  function renderEntityThumb(entity, item) {
    return entity === 'org' ? renderOrgThumb(item) : renderNpcThumb(item);
  }

  function filterEntities(entity, items, query) {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => {
      if (entity === 'org') {
        return (item.name || '').toLowerCase().includes(q) ||
          (item.summary || '').toLowerCase().includes(q);
      }
      return (item.name || '').toLowerCase().includes(q) ||
        (item.furigana || '').toLowerCase().includes(q) ||
        (item.occupation || '').toLowerCase().includes(q);
    });
  }

  function buildPlUrl(entity, itemId) {
    const def = getEntityDef(entity);
    const root = window.AppLinks?.plIndex || 'index.html';
    const base = root.includes('#') ? root.split('#')[0] : root;
    return `${base}#${def.plSection}/${encodeURIComponent(itemId)}`;
  }

  function renderListSummary(items) {
    const visible = items.filter(item => !item.pl_hidden).length;
    const hidden = items.length - visible;
    return `
      <span class="kp-npc-stat">全 <strong>${items.length}</strong> 件</span>
      <span class="kp-npc-stat kp-npc-stat--on">PL表示 <strong>${visible}</strong></span>
      <span class="kp-npc-stat kp-npc-stat--off">非表示 <strong>${hidden}</strong></span>
    `;
  }

  function renderEntityListCard(entity, item) {
    const hidden = Boolean(item.pl_hidden);
    const hasEdit = Boolean(item.edit_url);
    const plUrl = buildPlUrl(entity, item.id);

    if (entity === 'org') {
      return `
        <li class="kp-npc-card${hidden ? ' kp-npc-card--hidden' : ''}">
          ${renderOrgThumb(item)}
          <div class="kp-npc-card-main">
            <div class="kp-npc-card-top">
              <p class="kp-npc-card-name">${escapeHtml(item.name)}</p>
              <div class="kp-npc-card-badges">
                <span class="kp-npc-badge kp-npc-badge--pl${hidden ? ' is-off' : ''}">${hidden ? 'PL非表示' : 'PL表示中'}</span>
              </div>
            </div>
            <p class="kp-npc-card-job">${escapeHtml(item.summary || '概要未設定')}</p>
          </div>
          <div class="kp-npc-card-actions">
            ${hasEdit
              ? `<button type="button" class="kp-npc-card-btn" data-edit-url="${escapeAttr(item.edit_url)}">編集</button>`
              : '<span class="kp-npc-card-note">編集URLなし</span>'}
            ${hidden
              ? '<span class="kp-npc-card-note">PL未掲載</span>'
              : `<a href="${escapeAttr(plUrl)}" class="kp-npc-card-btn kp-npc-card-btn--link" target="_blank" rel="noopener noreferrer">PLで見る</a>`}
          </div>
        </li>
      `;
    }

    return `
      <li class="kp-npc-card${hidden ? ' kp-npc-card--hidden' : ''}">
        ${renderNpcThumb(item)}
        <div class="kp-npc-card-main">
          <div class="kp-npc-card-top">
            <p class="kp-npc-card-name">${escapeHtml(item.name)}</p>
            <div class="kp-npc-card-badges">
              ${item.status ? `<span class="kp-npc-badge kp-npc-badge--status ${statusBadgeClass(item.status)}">${escapeHtml(item.status)}</span>` : ''}
              <span class="kp-npc-badge kp-npc-badge--pl${hidden ? ' is-off' : ''}">${hidden ? 'PL非表示' : 'PL表示中'}</span>
            </div>
          </div>
          ${item.furigana ? `<p class="kp-npc-card-furi">${escapeHtml(item.furigana)}</p>` : ''}
          <p class="kp-npc-card-job">${escapeHtml(item.occupation || '職業未設定')}</p>
        </div>
        <div class="kp-npc-card-actions">
          ${hasEdit
            ? `<button type="button" class="kp-npc-card-btn" data-edit-url="${escapeAttr(item.edit_url)}">編集</button>`
            : '<span class="kp-npc-card-note">編集URLなし</span>'}
          ${hidden
            ? '<span class="kp-npc-card-note">PL未掲載</span>'
            : `<a href="${escapeAttr(plUrl)}" class="kp-npc-card-btn kp-npc-card-btn--link" target="_blank" rel="noopener noreferrer">PLで見る</a>`}
        </div>
      </li>
    `;
  }

  function renderEntityList(entity, items, filter) {
    const body = document.getElementById('kpEntityListBody');
    const def = getEntityDef(entity);

    let rows = items;
    if (filter === 'visible') rows = items.filter(item => !item.pl_hidden);
    if (filter === 'hidden') rows = items.filter(item => item.pl_hidden);

    if (!rows.length) {
      body.innerHTML = `<p class="kp-modal-empty">該当する ${escapeHtml(def.emptyLabel)} がありません。</p>`;
      return;
    }

    body.innerHTML = `
      <ul class="kp-npc-cards">
        ${rows.map(item => renderEntityListCard(entity, item)).join('')}
      </ul>
    `;

    body.querySelectorAll('[data-edit-url]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(btn.dataset.editUrl, '_blank', 'noopener,noreferrer');
      });
    });
  }

  function bindListFilters(entity, items) {
    const search = document.getElementById('kpEntityListSearch');
    const tabs = document.querySelectorAll('[data-kp-list-filter]');

    function refresh() {
      const summary = document.getElementById('kpEntityListSummary');
      if (summary) summary.innerHTML = renderListSummary(items);
      renderEntityList(entity, filterEntities(entity, items, search.value), listFilter);
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        listFilter = tab.dataset.kpListFilter || 'all';
        tabs.forEach(t => t.classList.toggle('is-active', t === tab));
        refresh();
      });
    });

    search.oninput = refresh;
    refresh();
  }

  async function openList(entity) {
    activeEntity = entity;
    const def = getEntityDef(entity);
    const body = document.getElementById('kpEntityListBody');
    const search = document.getElementById('kpEntityListSearch');
    const summary = document.getElementById('kpEntityListSummary');
    const hint = document.getElementById('kpEntityListHint');
    const title = document.getElementById('kpEntityListTitle');

    if (title) title.textContent = def.listTitle;
    if (hint) hint.textContent = def.listHint;
    search.placeholder = def.listSearchPlaceholder;

    openModal('kpEntityList');
    body.innerHTML = `<p class="kp-modal-status">${escapeHtml(def.emptyLabel)}一覧を読み込んでいます...</p>`;
    if (summary) summary.textContent = '';
    search.value = '';
    listFilter = 'all';
    document.querySelectorAll('[data-kp-list-filter]').forEach((tab, i) => {
      tab.classList.toggle('is-active', i === 0);
    });

    try {
      const items = await loadKpEntities(entity);
      bindListFilters(entity, items);
      search.focus();
    } catch (err) {
      body.innerHTML = `<p class="kp-modal-error">${escapeHtml(def.emptyLabel)}一覧を取得できませんでした。<br>${escapeHtml(err.message || 'エラー')}</p>`;
    }
  }

  function renderPickerList(entity, items) {
    const body = document.getElementById('kpEntityPickerBody');
    const def = getEntityDef(entity);

    if (!items.length) {
      body.innerHTML = `<p class="kp-modal-empty">登録済みの ${escapeHtml(def.emptyLabel)} がありません。先に新規登録してください。</p>`;
      return;
    }

    body.innerHTML = `
      <ul class="kp-picker-list" role="listbox">
        ${items.map(item => {
          const hasEdit = Boolean(item.edit_url);
          const disabled = hasEdit ? '' : ' kp-picker-item--disabled';
          const tag = hasEdit ? 'button' : 'div';
          const attrs = hasEdit
            ? ` type="button" data-edit-url="${escapeAttr(item.edit_url)}"`
            : ' aria-disabled="true"';
          const sub = entity === 'org'
            ? (item.summary ? `<span class="kp-picker-sub">${escapeHtml(item.summary)}</span>` : '')
            : (item.furigana ? `<span class="kp-picker-sub">${escapeHtml(item.furigana)}</span>` : '');
          const meta = entity === 'org'
            ? ''
            : `<span class="kp-picker-meta">
                ${item.occupation ? `<span>${escapeHtml(item.occupation)}</span>` : ''}
                ${item.status ? `<span class="list-item-badge ${statusBadgeClass(item.status)}">${escapeHtml(item.status)}</span>` : ''}
              </span>`;

          return `
            <li>
              <${tag} class="kp-picker-item${disabled}"${attrs} role="option">
                ${renderEntityThumb(entity, item)}
                <span class="kp-picker-body">
                  <span class="kp-picker-name">${escapeHtml(item.name)}</span>
                  ${sub}
                  ${meta}
                  ${hasEdit ? '' : '<span class="kp-picker-note">編集URLなし</span>'}
                </span>
              </${tag}>
            </li>
          `;
        }).join('')}
      </ul>
    `;

    body.querySelectorAll('[data-edit-url]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(btn.dataset.editUrl, '_blank', 'noopener,noreferrer');
        closePicker();
      });
    });
  }

  function renderVisibilityList(entity, items) {
    const body = document.getElementById('kpEntityVisibilityBody');
    const def = getEntityDef(entity);

    if (!items.length) {
      body.innerHTML = `<p class="kp-modal-empty">登録済みの ${escapeHtml(def.emptyLabel)} がありません。</p>`;
      return;
    }

    body.innerHTML = `
      <ul class="kp-picker-list" role="list">
        ${items.map(item => {
          const hidden = Boolean(item.pl_hidden);
          const rowClass = hidden ? ' kp-visibility-row--hidden' : '';
          const sub = entity === 'org'
            ? (item.summary ? `<span class="kp-picker-sub">${escapeHtml(item.summary)}</span>` : '')
            : (item.furigana ? `<span class="kp-picker-sub">${escapeHtml(item.furigana)}</span>` : '');

          return `
            <li>
              <div class="kp-picker-item kp-visibility-row${rowClass}" data-item-id="${escapeAttr(item.id)}">
                ${renderEntityThumb(entity, item)}
                <span class="kp-picker-body">
                  <span class="kp-picker-name">${escapeHtml(item.name)}</span>
                  ${sub}
                  <span class="kp-picker-meta">
                    ${hidden ? '<span class="kp-visibility-label kp-visibility-label--off">PL非表示</span>' : '<span class="kp-visibility-label">PL表示中</span>'}
                  </span>
                </span>
                <label class="kp-visibility-toggle" title="PLサイトで表示">
                  <input type="checkbox" class="kp-visibility-input" data-item-id="${escapeAttr(item.id)}"${hidden ? '' : ' checked'}>
                  <span class="kp-visibility-switch" aria-hidden="true"></span>
                  <span class="kp-visibility-toggle-text">表示</span>
                </label>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    `;

    body.querySelectorAll('.kp-visibility-input').forEach(input => {
      input.addEventListener('change', async () => {
        const itemId = input.dataset.itemId;
        const visible = input.checked;
        const row = input.closest('.kp-visibility-row');
        const label = row?.querySelector('.kp-visibility-label');
        input.disabled = true;

        try {
          await setEntityPlHidden(entity, itemId, !visible);
          if (row) row.classList.toggle('kp-visibility-row--hidden', !visible);
          if (label) {
            label.textContent = visible ? 'PL表示中' : 'PL非表示';
            label.classList.toggle('kp-visibility-label--off', !visible);
          }
          const cached = entityCache[entity];
          if (cached) {
            const target = cached.find(row => row.id === itemId);
            if (target) target.pl_hidden = !visible;
          }
        } catch (err) {
          input.checked = !visible;
          alert(`表示設定の更新に失敗しました。\n${err.message || 'エラー'}`);
        } finally {
          input.disabled = false;
        }
      });
    });
  }

  async function openVisibility(entity) {
    activeEntity = entity;
    const def = getEntityDef(entity);
    const body = document.getElementById('kpEntityVisibilityBody');
    const search = document.getElementById('kpEntityVisibilitySearch');
    const hint = document.getElementById('kpEntityVisibilityHint');
    const title = document.getElementById('kpEntityVisibilityTitle');

    if (title) title.textContent = def.visibilityTitle;
    if (hint) hint.textContent = def.visibilityHint;
    search.placeholder = def.visibilitySearchPlaceholder;

    openModal('kpEntityVisibility');
    body.innerHTML = `<p class="kp-modal-status">${escapeHtml(def.emptyLabel)}一覧を読み込んでいます...</p>`;
    search.value = '';

    try {
      const items = await loadKpEntities(entity);
      await ensureVisibilityApi(entity);
      renderVisibilityList(entity, items);
      search.oninput = () => renderVisibilityList(entity, filterEntities(entity, items, search.value));
      search.focus();
    } catch (err) {
      body.innerHTML = `<p class="kp-modal-error">${escapeHtml(def.emptyLabel)}一覧を取得できませんでした。<br>${escapeHtml(err.message || 'エラー')}</p>`;
    }
  }

  async function openPicker(entity) {
    activeEntity = entity;
    const def = getEntityDef(entity);
    const body = document.getElementById('kpEntityPickerBody');
    const search = document.getElementById('kpEntityPickerSearch');
    const title = document.getElementById('kpEntityPickerTitle');

    if (title) title.textContent = def.pickerTitle;
    search.placeholder = def.pickerSearchPlaceholder;

    openModal('kpEntityPicker');
    body.innerHTML = `<p class="kp-modal-status">${escapeHtml(def.emptyLabel)}一覧を読み込んでいます...</p>`;
    search.value = '';

    try {
      const items = await loadKpEntities(entity);
      renderPickerList(entity, items);
      search.oninput = () => renderPickerList(entity, filterEntities(entity, items, search.value));
      search.focus();
    } catch (err) {
      body.innerHTML = `<p class="kp-modal-error">${escapeHtml(def.emptyLabel)}一覧を取得できませんでした。<br>${escapeHtml(err.message || 'エラー')}</p>`;
    }
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function closePicker() {
    closeModal('kpEntityPicker');
  }

  function closeList() {
    closeModal('kpEntityList');
  }

  function closeVisibility() {
    closeModal('kpEntityVisibility');
  }

  function bindModal() {
    document.querySelectorAll('[data-kp-close]').forEach(el => {
      el.addEventListener('click', () => {
        const modalId = el.getAttribute('data-kp-close');
        if (modalId === 'kpEntityVisibility') closeVisibility();
        else if (modalId === 'kpEntityList') closeList();
        else closePicker();
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('kpEntityPicker').hidden) closePicker();
      if (!document.getElementById('kpEntityVisibility').hidden) closeVisibility();
      if (!document.getElementById('kpEntityList').hidden) closeList();
    });
  }

  function renderFilesDriveSection() {
    const section = document.getElementById('kpFilesDrive');
    if (!section) return;

    const url = String(window.AppLinks?.filesDriveFolder || '').trim();
    const ready = url && url !== '#';

    section.innerHTML = `
      <h2 class="kp-section-title" id="kpFilesDriveTitle">資料フォルダ</h2>
      <article class="kp-card kp-card--drive">
        <span class="kp-card-icon">📁</span>
        <h3 class="kp-card-name">PL向け資料置き場（Google ドライブ）</h3>
        <p class="kp-card-desc">
          ハンドアウト・地図・画像などをフォルダにドラッグ＆ドロップするだけでOKです。
          PLサイトの「資料」から同じフォルダが開きます。フォームや Git は不要です。
        </p>
        <div class="kp-card-actions">
          ${ready
            ? `<a href="${escapeAttr(url)}" class="kp-card-btn" target="_blank" rel="noopener noreferrer">フォルダを開く${EXTERNAL_ICON}</a>`
            : '<span class="kp-card-btn kp-card-btn--disabled" aria-disabled="true">URL未設定（links.js）</span>'}
        </div>
      </article>
    `;
  }

  renderCards();
  renderFilesDriveSection();
  bindModal();
})();
