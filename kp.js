/**
 * KP入力ページ — フォームリンク集 + NPC編集ピッカー
 */
(function () {
  const FORM_CARDS = [
    {
      linkKey: 'npcForm',
      icon: '🧑‍🤝‍🧑',
      name: 'NPC登録フォーム',
      description: 'NPCの名前、画像、人物紹介、エピソード、関連情報を登録するフォーム。',
      editable: true,
      visibilityControl: true
    },
    {
      linkKey: 'organizationForm',
      icon: '🏛️',
      name: '組織登録フォーム',
      description: '組織の名称、説明、所在地、概要を登録するフォーム。'
    },
    {
      linkKey: 'scenarioForm',
      icon: '📜',
      name: 'シナリオ登録フォーム',
      description: 'シナリオの名称、概要、年代、関連情報を登録するフォーム。'
    },
    {
      linkKey: 'pcForm',
      icon: '👤',
      name: 'PC登録フォーム',
      description: 'PCの名前、プレイヤー名、説明、関連NPCを登録するフォーム。'
    }
  ];

  const EXTERNAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>';

  let npcCache = null;
  let npcLoadError = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function buildNpcApiUrl({ kp = false } = {}) {
    const base = window.AppConfig?.api?.baseUrl || '';
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}type=npcs${kp ? '&kp=1' : ''}`;
  }

  function buildVisibilityApiUrl(npcId, hidden) {
    const base = window.AppConfig?.api?.baseUrl || '';
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}type=npc-visibility&id=${encodeURIComponent(npcId)}&hidden=${hidden ? '1' : '0'}`;
  }

  function invalidateNpcCache() {
    npcCache = null;
    npcLoadError = null;
  }

  function fetchJsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = `_kpNpcCb_${Date.now()}`;
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
          reject(new Error('NPC一覧の形式が不正です'));
          return;
        }
        resolve(data);
      };

      script.onerror = () => cleanup(reject, new Error('NPC一覧の取得に失敗しました'));
      script.src = `${url}&callback=${cb}`;
      document.head.appendChild(script);
    });
  }

  async function fetchNpcArray(url) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('配列ではありません');
      return data;
    } catch (err) {
      return fetchJsonp(url);
    }
  }

  function mergeNpcImages(kpNpcs, publicNpcs) {
    const imageById = new Map(
      (publicNpcs || []).map(npc => [npc.id, npc.image_url || npc.imageUrl || npc.image || ''])
    );
    return kpNpcs.map(npc => ({
      ...npc,
      image_url: npc.image_url || imageById.get(npc.id) || '',
      pl_hidden: Boolean(npc.pl_hidden)
    }));
  }

  async function setNpcPlHidden(npcId, hidden) {
    const url = buildVisibilityApiUrl(npcId, hidden);
    if (!url) throw new Error('API URL が未設定です（js/config.js）');

    const res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.ok) throw new Error('更新に失敗しました');

    invalidateNpcCache();
    return data;
  }

  async function loadKpNpcs() {
    if (npcCache) return npcCache;
    if (npcLoadError) throw npcLoadError;

    const kpUrl = buildNpcApiUrl({ kp: true });
    const publicUrl = buildNpcApiUrl({ kp: false });
    if (!kpUrl) {
      npcLoadError = new Error('API URL が未設定です（js/config.js）');
      throw npcLoadError;
    }

    try {
      const [kpNpcs, publicNpcs] = await Promise.all([
        fetchNpcArray(kpUrl),
        fetchNpcArray(publicUrl).catch(() => [])
      ]);
      npcCache = mergeNpcImages(kpNpcs, publicNpcs);
      return npcCache;
    } catch (err) {
      npcLoadError = err;
      throw err;
    }
  }

  function renderCardActions(card, url, isReady) {
    if (!isReady) {
      return `<span class="kp-card-btn kp-card-btn--disabled" aria-disabled="true">準備中</span>`;
    }

    const newBtn = `<a href="${escapeAttr(url)}" class="kp-card-btn" target="_blank" rel="noopener noreferrer">新規登録${EXTERNAL_ICON}</a>`;

    if (!card.editable) {
      return `<div class="kp-card-actions">${newBtn}</div>`;
    }

    return `
      <div class="kp-card-actions">
        ${newBtn}
        <button type="button" class="kp-card-btn kp-card-btn--secondary" data-kp-edit-npc>編集</button>
        <button type="button" class="kp-card-btn kp-card-btn--secondary" data-kp-visibility-npc>表示設定</button>
      </div>
    `;
  }

  function renderCards() {
    const grid = document.getElementById('kpCardGrid');
    const links = window.AppLinks || {};

    grid.innerHTML = FORM_CARDS.map(card => {
      const url = links[card.linkKey] || '#';
      const isReady = url && url !== '#';

      return `
        <article class="kp-card">
          <span class="kp-card-icon">${card.icon}</span>
          <h2 class="kp-card-name">${escapeHtml(card.name)}</h2>
          <p class="kp-card-desc">${escapeHtml(card.description)}</p>
          ${renderCardActions(card, url, isReady)}
        </article>
      `;
    }).join('');

    grid.querySelector('[data-kp-edit-npc]')?.addEventListener('click', openNpcPicker);
    grid.querySelector('[data-kp-visibility-npc]')?.addEventListener('click', openNpcVisibility);
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
    try {
      const svg = decodeURIComponent(img.getAttribute('data-svg-fallback') || '');
      if (svg) img.src = svg;
    } catch (e) {
      /* ignore */
    }
  };

  function renderPickerAvatar(npc) {
    const svgFallback = generatePickerAvatarFallback(npc.name);
    const url = npc.image_url || '';
    const utils = window.ImageUtils;
    const { src, fallbacks } = utils
      ? utils.buildImgAttrs(url, svgFallback)
      : { src: url || svgFallback, fallbacks: [] };
    const fallbacksEncoded = encodeURIComponent(JSON.stringify(fallbacks));
    const svgEncoded = encodeURIComponent(svgFallback);

    return `<img class="kp-picker-avatar"` +
      ` src="${escapeAttr(src)}"` +
      ` alt=""` +
      ` loading="lazy"` +
      ` decoding="async"` +
      ` referrerpolicy="no-referrer"` +
      ` data-fallbacks="${fallbacksEncoded}"` +
      ` data-svg-fallback="${svgEncoded}"` +
      ` onerror="handleArchiveImgError(this)">`;
  }

  function filterNpcs(npcs, query) {
    const q = query.trim().toLowerCase();
    if (!q) return npcs;
    return npcs.filter(npc =>
      (npc.name || '').toLowerCase().includes(q) ||
      (npc.furigana || '').toLowerCase().includes(q) ||
      (npc.occupation || '').toLowerCase().includes(q)
    );
  }

  function renderNpcPickerList(npcs) {
    const body = document.getElementById('kpNpcPickerBody');
    if (!npcs.length) {
      body.innerHTML = '<p class="kp-modal-empty">登録済みの NPC がありません。先に新規登録してください。</p>';
      return;
    }

    body.innerHTML = `
      <ul class="kp-picker-list" role="listbox">
        ${npcs.map(npc => {
          const hasEdit = Boolean(npc.edit_url);
          const disabled = hasEdit ? '' : ' kp-picker-item--disabled';
          const tag = hasEdit ? 'button' : 'div';
          const attrs = hasEdit
            ? ` type="button" data-edit-url="${escapeAttr(npc.edit_url)}"`
            : ' aria-disabled="true"';
          return `
            <li>
              <${tag} class="kp-picker-item${disabled}"${attrs} role="option">
                ${renderPickerAvatar(npc)}
                <span class="kp-picker-body">
                  <span class="kp-picker-name">${escapeHtml(npc.name)}</span>
                  ${npc.furigana ? `<span class="kp-picker-sub">${escapeHtml(npc.furigana)}</span>` : ''}
                  <span class="kp-picker-meta">
                    ${npc.occupation ? `<span>${escapeHtml(npc.occupation)}</span>` : ''}
                    ${npc.status ? `<span class="list-item-badge ${statusBadgeClass(npc.status)}">${escapeHtml(npc.status)}</span>` : ''}
                  </span>
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
        closeNpcPicker();
      });
    });
  }

  function renderNpcVisibilityList(npcs) {
    const body = document.getElementById('kpNpcVisibilityBody');
    if (!npcs.length) {
      body.innerHTML = '<p class="kp-modal-empty">登録済みの NPC がありません。</p>';
      return;
    }

    body.innerHTML = `
      <ul class="kp-picker-list" role="list">
        ${npcs.map(npc => {
          const hidden = Boolean(npc.pl_hidden);
          const rowClass = hidden ? ' kp-visibility-row--hidden' : '';
          return `
            <li>
              <div class="kp-picker-item kp-visibility-row${rowClass}" data-npc-id="${escapeAttr(npc.id)}">
                ${renderPickerAvatar(npc)}
                <span class="kp-picker-body">
                  <span class="kp-picker-name">${escapeHtml(npc.name)}</span>
                  ${npc.furigana ? `<span class="kp-picker-sub">${escapeHtml(npc.furigana)}</span>` : ''}
                  <span class="kp-picker-meta">
                    ${hidden ? '<span class="kp-visibility-label kp-visibility-label--off">PL非表示</span>' : '<span class="kp-visibility-label">PL表示中</span>'}
                  </span>
                </span>
                <label class="kp-visibility-toggle" title="PLサイトで表示">
                  <input type="checkbox" class="kp-visibility-input" data-npc-id="${escapeAttr(npc.id)}"${hidden ? '' : ' checked'}>
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
        const npcId = input.dataset.npcId;
        const visible = input.checked;
        const row = input.closest('.kp-visibility-row');
        const label = row?.querySelector('.kp-visibility-label');
        input.disabled = true;

        try {
          await setNpcPlHidden(npcId, !visible);
          if (row) {
            row.classList.toggle('kp-visibility-row--hidden', !visible);
          }
          if (label) {
            label.textContent = visible ? 'PL表示中' : 'PL非表示';
            label.classList.toggle('kp-visibility-label--off', !visible);
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

  async function openNpcVisibility() {
    const body = document.getElementById('kpNpcVisibilityBody');
    const search = document.getElementById('kpNpcVisibilitySearch');

    openModal('kpNpcVisibility');
    body.innerHTML = '<p class="kp-modal-status">NPC一覧を読み込んでいます...</p>';
    search.value = '';

    try {
      const npcs = await loadKpNpcs();
      renderNpcVisibilityList(npcs);
      search.oninput = () => renderNpcVisibilityList(filterNpcs(npcs, search.value));
      search.focus();
    } catch (err) {
      body.innerHTML = `<p class="kp-modal-error">NPC一覧を取得できませんでした。<br>${escapeHtml(err.message || 'エラー')}</p>`;
    }
  }

  async function openNpcPicker() {
    const body = document.getElementById('kpNpcPickerBody');
    const search = document.getElementById('kpNpcSearch');

    openModal('kpNpcPicker');
    body.innerHTML = '<p class="kp-modal-status">NPC一覧を読み込んでいます...</p>';
    search.value = '';

    try {
      const npcs = await loadKpNpcs();
      renderNpcPickerList(npcs);
      search.oninput = () => renderNpcPickerList(filterNpcs(npcs, search.value));
      search.focus();
    } catch (err) {
      body.innerHTML = `<p class="kp-modal-error">NPC一覧を取得できませんでした。<br>${escapeHtml(err.message || 'エラー')}</p>`;
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

  function closeNpcPicker() {
    closeModal('kpNpcPicker');
  }

  function closeNpcVisibility() {
    closeModal('kpNpcVisibility');
  }

  function bindModal() {
    document.querySelectorAll('[data-kp-close]').forEach(el => {
      el.addEventListener('click', () => {
        const modalId = el.getAttribute('data-kp-close');
        if (modalId === 'kpNpcVisibility') closeNpcVisibility();
        else closeNpcPicker();
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('kpNpcPicker').hidden) closeNpcPicker();
      if (!document.getElementById('kpNpcVisibility').hidden) closeNpcVisibility();
    });
  }

  renderCards();
  bindModal();
})();
