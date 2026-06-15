/* ========================================
   TRPG World Archive v0.1
   ======================================== */

const STATUS_LABELS = {
  alive: '生存',
  dead: '死亡',
  missing: '行方不明',
  unknown: '不明'
};

const STATUS_CLASSES = {
  alive: 'status-alive',
  dead: 'status-dead',
  missing: 'status-missing',
  unknown: 'status-unknown'
};

const store = {
  npcs: [],
  organizations: [],
  scenarios: [],
  pcs: [],
  locations: []
};

const indexes = {
  npcById: new Map(),
  orgById: new Map(),
  scenarioById: new Map(),
  pcById: new Map(),
  locationById: new Map(),
  npcsByOrgId: new Map()
};

let route = { section: 'npcs', id: null };

const contentArea = document.getElementById('contentArea');
const globalSearch = document.getElementById('globalSearch');
const navMenu = document.getElementById('navMenu');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuToggle = document.getElementById('menuToggle');
const sidebarClose = document.getElementById('sidebarClose');

/* ---- Data Loading ---- */

async function loadData() {
  const [npcs, organizations, scenarios, pcs, locations] = await Promise.all([
    fetch('data/npcs.json').then(r => r.json()),
    fetch('data/organizations.json').then(r => r.json()),
    fetch('data/scenarios.json').then(r => r.json()),
    fetch('data/pcs.json').then(r => r.json()),
    fetch('data/locations.json').then(r => r.json())
  ]);

  store.npcs = npcs.npcs;
  store.organizations = organizations.organizations;
  store.scenarios = scenarios.scenarios;
  store.pcs = pcs.pcs;
  store.locations = locations.locations;

  buildIndexes();
}

function buildIndexes() {
  indexes.npcById.clear();
  indexes.orgById.clear();
  indexes.scenarioById.clear();
  indexes.pcById.clear();
  indexes.locationById.clear();
  indexes.npcsByOrgId.clear();

  store.npcs.forEach(npc => indexes.npcById.set(npc.id, npc));
  store.organizations.forEach(org => indexes.orgById.set(org.id, org));
  store.scenarios.forEach(sc => indexes.scenarioById.set(sc.id, sc));
  store.pcs.forEach(pc => indexes.pcById.set(pc.id, pc));
  store.locations.forEach(loc => indexes.locationById.set(loc.id, loc));

  store.npcs.forEach(npc => {
    (npc.organizationIds || []).forEach(orgId => {
      if (!indexes.npcsByOrgId.has(orgId)) {
        indexes.npcsByOrgId.set(orgId, []);
      }
      indexes.npcsByOrgId.get(orgId).push(npc);
    });
  });
}

/* ---- Avatar Generator ---- */

function generatePortrait(name, bg = '#1a3a2a', accent = '#c9a84c') {
  const initial = name.charAt(0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.3"/>
      </linearGradient>
    </defs>
    <rect width="280" height="280" fill="url(#bg)"/>
    <circle cx="140" cy="100" r="50" fill="${accent}" opacity="0.5"/>
    <ellipse cx="140" cy="240" rx="80" ry="60" fill="${accent}" opacity="0.3"/>
    <text x="140" y="110" text-anchor="middle" fill="#fff" font-size="48" font-family="sans-serif" font-weight="700" opacity="0.8">${initial}</text>
    <rect x="20" y="20" width="240" height="240" rx="12" fill="none" stroke="${accent}" stroke-width="2" opacity="0.3"/>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function generateAvatar(name, bg = '#2d5a3d', accent = '#4a9eff') {
  const initial = name.charAt(0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="${bg}"/>
    <circle cx="40" cy="32" r="14" fill="${accent}" opacity="0.6"/>
    <ellipse cx="40" cy="68" rx="22" ry="16" fill="${accent}" opacity="0.4"/>
    <text x="40" y="36" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="600">${initial}</text>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function npcImage(npc) {
  return npc.image || generatePortrait(npc.name);
}

function npcAvatar(npc) {
  return npc.avatar || generateAvatar(npc.name);
}

/* ---- Routing ---- */

function parseHash() {
  const hash = location.hash.slice(1) || 'npcs';
  const parts = hash.split('/').filter(Boolean);
  return { section: parts[0] || 'npcs', id: parts[1] || null };
}

function navigate(section, id) {
  const hash = id ? `#${section}/${id}` : `#${section}`;
  if (location.hash !== hash) {
    location.hash = hash;
  } else {
    route = { section, id };
    render();
  }
}

function onHashChange() {
  route = parseHash();
  updateNavActive();
  render();
}

function updateNavActive() {
  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === route.section);
  });
}

/* ---- Search ---- */

function getSearchQuery() {
  return globalSearch.value.toLowerCase().trim();
}

function matchesQuery(text, query) {
  return !query || (text || '').toLowerCase().includes(query);
}

function filterNpcs(query) {
  return store.npcs.filter(npc =>
    matchesQuery(npc.name, query) ||
    matchesQuery(npc.furigana, query) ||
    matchesQuery(npc.job, query)
  );
}

function filterOrganizations(query) {
  return store.organizations.filter(org =>
    matchesQuery(org.name, query) ||
    matchesQuery(org.summary, query)
  );
}

function filterScenarios(query) {
  return store.scenarios.filter(sc =>
    matchesQuery(sc.title, query) ||
    matchesQuery(sc.summary, query)
  );
}

function filterPcs(query) {
  return store.pcs.filter(pc =>
    matchesQuery(pc.name, query) ||
    matchesQuery(pc.playerName, query)
  );
}

/* ---- Render Helpers ---- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLink(href, label, sub = '') {
  return `<a href="${href}" class="entity-link">${escapeHtml(label)}${sub ? `<span class="link-sub">${escapeHtml(sub)}</span>` : ''}</a>`;
}

function renderEmpty(message = 'なし') {
  return `<p class="empty-note">${message}</p>`;
}

function renderListLayout(listHtml, detailHtml) {
  return `
    <div class="list-panel">${listHtml}</div>
    <div class="detail-panel">${detailHtml}</div>
  `;
}

function bindListItems() {
  contentArea.querySelectorAll('[data-nav-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.navSection, el.dataset.navId);
      closeSidebar();
    });
  });
}

/* ---- NPC Views ---- */

function renderNpcListItem(npc, active) {
  return `
    <li class="list-item ${active ? 'active' : ''}"
        data-nav-section="npcs"
        data-nav-id="${npc.id}"
        role="option"
        aria-selected="${active}">
      <img class="list-avatar" src="${npcAvatar(npc)}" alt="">
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(npc.name)}</div>
        <div class="list-item-sub">${escapeHtml(npc.job)}</div>
      </div>
      <span class="list-item-badge ${STATUS_CLASSES[npc.status]}">${STATUS_LABELS[npc.status]}</span>
    </li>
  `;
}

function renderNpcDetail(npc) {
  const orgs = (npc.organizationIds || [])
    .map(id => indexes.orgById.get(id))
    .filter(Boolean);

  const orgLinks = orgs.length
    ? orgs.map(o => renderLink(`#organizations/${o.id}`, o.name)).join('、')
    : '—';

  return `
    <article class="entity-detail">
      <header class="detail-header">
        <img class="detail-image" src="${npcImage(npc)}" alt="${escapeHtml(npc.name)}">
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(npc.name)}</h1>
          <p class="detail-furigana">${escapeHtml(npc.furigana || '')}</p>
          <dl class="info-grid">
            <div class="info-row"><dt>生年月日</dt><dd>${escapeHtml(npc.birthdate || '—')}</dd></div>
            <div class="info-row"><dt>年齢</dt><dd>${escapeHtml(String(npc.age ?? '—'))}</dd></div>
            <div class="info-row"><dt>国籍</dt><dd>${escapeHtml(npc.nationality || '—')}</dd></div>
            <div class="info-row"><dt>出身地</dt><dd>${escapeHtml(npc.origin || '—')}</dd></div>
            <div class="info-row"><dt>職業</dt><dd>${escapeHtml(npc.job || '—')}</dd></div>
            <div class="info-row"><dt>所属組織</dt><dd>${orgLinks}</dd></div>
            <div class="info-row"><dt>状態</dt><dd><span class="badge ${STATUS_CLASSES[npc.status]}">${STATUS_LABELS[npc.status]}</span></dd></div>
          </dl>
        </div>
      </header>

      <section class="detail-section">
        <h2 class="section-heading">人物紹介</h2>
        <div class="prose">
          ${(npc.bio || []).map(p => `<p>${escapeHtml(p)}</p>`).join('') || renderEmpty()}
        </div>
      </section>

      <section class="detail-section">
        <h2 class="section-heading">人物</h2>
        <dl class="info-grid info-grid--compact">
          <div class="info-row"><dt>家族</dt><dd>${escapeHtml(npc.person?.family || '—')}</dd></div>
          <div class="info-row"><dt>ペット</dt><dd>${escapeHtml(npc.person?.pet || '—')}</dd></div>
          <div class="info-row"><dt>特徴</dt><dd>${escapeHtml(npc.person?.traits || '—')}</dd></div>
          <div class="info-row"><dt>性格</dt><dd>${escapeHtml(npc.person?.personality || '—')}</dd></div>
        </dl>
      </section>

      <section class="detail-section">
        <h2 class="section-heading">エピソード</h2>
        ${npc.episodes?.length ? `
          <div class="episode-list">
            ${npc.episodes.map(ep => `
              <div class="episode-item">
                <span class="episode-icon">${ep.icon || '📌'}</span>
                <div class="episode-body">
                  <h3>${escapeHtml(ep.title)}</h3>
                  <p>${escapeHtml(ep.desc)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        ` : renderEmpty()}
      </section>

      <section class="detail-section">
        <h2 class="section-heading">連絡可能PC</h2>
        ${npc.contactablePcIds?.length ? `
          <ul class="link-list">
            ${npc.contactablePcIds.map(pcId => {
              const pc = indexes.pcById.get(pcId);
              return pc ? `<li>${renderLink(`#pcs/${pc.id}`, pc.name, pc.playerName)}</li>` : '';
            }).join('')}
          </ul>
        ` : renderEmpty()}
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連情報</h2>
        <div class="related-grid">
          <div class="related-block">
            <h3>登場シナリオ</h3>
            ${npc.scenarioIds?.length ? `
              <ul class="link-list">
                ${npc.scenarioIds.map(id => {
                  const sc = indexes.scenarioById.get(id);
                  return sc ? `<li>${renderLink(`#scenarios/${sc.id}`, sc.title, sc.era)}</li>` : '';
                }).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>関連NPC</h3>
            ${npc.relatedNpcIds?.length ? `
              <ul class="link-list">
                ${npc.relatedNpcIds.map(r => {
                  const rel = indexes.npcById.get(r.npcId);
                  return rel ? `<li>${renderLink(`#npcs/${rel.id}`, rel.name, r.relation)}</li>` : '';
                }).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>所属組織</h3>
            ${orgs.length ? `
              <ul class="link-list">
                ${orgs.map(o => `<li>${renderLink(`#organizations/${o.id}`, o.name)}</li>`).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>関連場所</h3>
            ${npc.locationIds?.length ? `
              <ul class="link-list">
                ${npc.locationIds.map(id => {
                  const loc = indexes.locationById.get(id);
                  return loc ? `<li><span class="location-item">${loc.icon || '📍'} ${escapeHtml(loc.name)}</span></li>` : '';
                }).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
        </div>
      </section>
    </article>
  `;
}

function renderNpcsView() {
  const query = getSearchQuery();
  const filtered = filterNpcs(query);
  const activeId = route.id || filtered[0]?.id;
  if (activeId && route.id !== activeId && filtered.some(n => n.id === activeId)) {
    route.id = activeId;
  }
  const activeNpc = activeId ? indexes.npcById.get(activeId) : null;

  const listHtml = `
    <div class="panel-header">
      <h2 class="panel-title">NPC</h2>
      <span class="panel-count">${filtered.length} 件</span>
    </div>
    <ul class="entity-list" role="listbox">
      ${filtered.map(npc => renderNpcListItem(npc, npc.id === activeId)).join('')}
    </ul>
  `;

  const detailHtml = activeNpc
    ? renderNpcDetail(activeNpc)
    : `<div class="detail-empty"><p>NPCが見つかりません</p></div>`;

  contentArea.innerHTML = renderListLayout(listHtml, detailHtml);
  bindListItems();
}

/* ---- Organization Views ---- */

function renderOrgListItem(org, active) {
  const memberCount = (indexes.npcsByOrgId.get(org.id) || []).length;
  return `
    <li class="list-item ${active ? 'active' : ''}"
        data-nav-section="organizations"
        data-nav-id="${org.id}"
        role="option">
      <span class="list-icon">${org.icon || '🏛️'}</span>
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(org.name)}</div>
        <div class="list-item-sub">所属NPC ${memberCount} 名</div>
      </div>
    </li>
  `;
}

function renderOrgDetail(org) {
  const members = indexes.npcsByOrgId.get(org.id) || [];
  const scenarios = (org.scenarioIds || []).map(id => indexes.scenarioById.get(id)).filter(Boolean);
  const location = org.locationId ? indexes.locationById.get(org.locationId) : null;

  return `
    <article class="entity-detail">
      <header class="detail-header detail-header--compact">
        <span class="detail-org-icon">${org.icon || '🏛️'}</span>
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(org.name)}</h1>
          <p class="detail-summary">${escapeHtml(org.summary || '')}</p>
        </div>
      </header>

      <section class="detail-section">
        <h2 class="section-heading">概要</h2>
        <div class="prose">
          ${(org.description || []).map(p => `<p>${escapeHtml(p)}</p>`).join('') || renderEmpty()}
        </div>
      </section>

      <section class="detail-section">
        <h2 class="section-heading">所在地</h2>
        <p>${location ? `${location.icon || '📍'} ${escapeHtml(location.name)}` : '—'}</p>
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連情報</h2>
        <div class="related-grid">
          <div class="related-block">
            <h3>所属NPC</h3>
            ${members.length ? `
              <ul class="link-list">
                ${members.map(npc => `<li>${renderLink(`#npcs/${npc.id}`, npc.name, npc.job)}</li>`).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>関連シナリオ</h3>
            ${scenarios.length ? `
              <ul class="link-list">
                ${scenarios.map(sc => `<li>${renderLink(`#scenarios/${sc.id}`, sc.title, sc.era)}</li>`).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
        </div>
      </section>
    </article>
  `;
}

function renderOrganizationsView() {
  const query = getSearchQuery();
  const filtered = filterOrganizations(query);
  const activeId = route.id || filtered[0]?.id;
  const activeOrg = activeId ? indexes.orgById.get(activeId) : null;

  const listHtml = `
    <div class="panel-header">
      <h2 class="panel-title">組織</h2>
      <span class="panel-count">${filtered.length} 件</span>
    </div>
    <ul class="entity-list">
      ${filtered.map(org => renderOrgListItem(org, org.id === activeId)).join('')}
    </ul>
  `;

  const detailHtml = activeOrg
    ? renderOrgDetail(activeOrg)
    : `<div class="detail-empty"><p>組織が見つかりません</p></div>`;

  contentArea.innerHTML = renderListLayout(listHtml, detailHtml);
  bindListItems();
}

/* ---- Scenario Views ---- */

function renderScenarioListItem(sc, active) {
  return `
    <li class="list-item ${active ? 'active' : ''}"
        data-nav-section="scenarios"
        data-nav-id="${sc.id}"
        role="option">
      <span class="list-icon">📜</span>
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(sc.title)}</div>
        <div class="list-item-sub">${escapeHtml(sc.era || '')}</div>
      </div>
    </li>
  `;
}

function renderScenarioDetail(sc) {
  const npcs = (sc.npcIds || []).map(id => indexes.npcById.get(id)).filter(Boolean);
  const orgs = (sc.organizationIds || []).map(id => indexes.orgById.get(id)).filter(Boolean);
  const related = (sc.relatedScenarioIds || []).map(id => indexes.scenarioById.get(id)).filter(Boolean);

  return `
    <article class="entity-detail">
      <header class="detail-header detail-header--compact">
        <span class="detail-org-icon">📜</span>
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(sc.title)}</h1>
          <p class="detail-meta">年代：${escapeHtml(sc.era || '—')}</p>
        </div>
      </header>

      <section class="detail-section">
        <h2 class="section-heading">概要</h2>
        <div class="prose"><p>${escapeHtml(sc.summary || '—')}</p></div>
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連情報</h2>
        <div class="related-grid">
          <div class="related-block">
            <h3>登場NPC</h3>
            ${npcs.length ? `
              <ul class="link-list">
                ${npcs.map(npc => `<li>${renderLink(`#npcs/${npc.id}`, npc.name, npc.job)}</li>`).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>登場組織</h3>
            ${orgs.length ? `
              <ul class="link-list">
                ${orgs.map(o => `<li>${renderLink(`#organizations/${o.id}`, o.name)}</li>`).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>関連シナリオ</h3>
            ${related.length ? `
              <ul class="link-list">
                ${related.map(r => `<li>${renderLink(`#scenarios/${r.id}`, r.title, r.era)}</li>`).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
        </div>
      </section>
    </article>
  `;
}

function renderScenariosView() {
  const query = getSearchQuery();
  const filtered = filterScenarios(query);
  const activeId = route.id || filtered[0]?.id;
  const activeSc = activeId ? indexes.scenarioById.get(activeId) : null;

  const listHtml = `
    <div class="panel-header">
      <h2 class="panel-title">シナリオ</h2>
      <span class="panel-count">${filtered.length} 件</span>
    </div>
    <ul class="entity-list">
      ${filtered.map(sc => renderScenarioListItem(sc, sc.id === activeId)).join('')}
    </ul>
  `;

  const detailHtml = activeSc
    ? renderScenarioDetail(activeSc)
    : `<div class="detail-empty"><p>シナリオが見つかりません</p></div>`;

  contentArea.innerHTML = renderListLayout(listHtml, detailHtml);
  bindListItems();
}

/* ---- PC Views ---- */

function renderPcListItem(pc, active) {
  return `
    <li class="list-item ${active ? 'active' : ''}"
        data-nav-section="pcs"
        data-nav-id="${pc.id}"
        role="option">
      <span class="list-icon">👤</span>
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(pc.name)}</div>
        <div class="list-item-sub">${escapeHtml(pc.playerName || '')}</div>
      </div>
    </li>
  `;
}

function renderPcDetail(pc) {
  const relatedNpcs = (pc.relatedNpcIds || []).map(id => indexes.npcById.get(id)).filter(Boolean);

  return `
    <article class="entity-detail">
      <header class="detail-header detail-header--compact">
        <span class="detail-org-icon">👤</span>
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(pc.name)}</h1>
          <p class="detail-meta">プレイヤー：${escapeHtml(pc.playerName || '—')}</p>
        </div>
      </header>

      <section class="detail-section">
        <h2 class="section-heading">基本情報</h2>
        <dl class="info-grid info-grid--compact">
          <div class="info-row"><dt>所属</dt><dd>${escapeHtml(pc.affiliation || '—')}</dd></div>
        </dl>
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連NPC</h2>
        ${relatedNpcs.length ? `
          <ul class="link-list">
            ${relatedNpcs.map(npc => `<li>${renderLink(`#npcs/${npc.id}`, npc.name, npc.job)}</li>`).join('')}
          </ul>
        ` : renderEmpty()}
      </section>
    </article>
  `;
}

function renderPcsView() {
  const query = getSearchQuery();
  const filtered = filterPcs(query);
  const activeId = route.id || filtered[0]?.id;
  const activePc = activeId ? indexes.pcById.get(activeId) : null;

  const listHtml = `
    <div class="panel-header">
      <h2 class="panel-title">PC</h2>
      <span class="panel-count">${filtered.length} 件</span>
    </div>
    <ul class="entity-list">
      ${filtered.map(pc => renderPcListItem(pc, pc.id === activeId)).join('')}
    </ul>
  `;

  const detailHtml = activePc
    ? renderPcDetail(activePc)
    : `<div class="detail-empty"><p>PCが見つかりません</p></div>`;

  contentArea.innerHTML = renderListLayout(listHtml, detailHtml);
  bindListItems();
}

/* ---- Main Render ---- */

function render() {
  switch (route.section) {
    case 'organizations':
      renderOrganizationsView();
      break;
    case 'scenarios':
      renderScenariosView();
      break;
    case 'pcs':
      renderPcsView();
      break;
    case 'npcs':
    default:
      renderNpcsView();
      break;
  }

  document.title = route.id
    ? `TRPG World Archive — ${route.section}`
    : 'TRPG World Archive';
}

/* ---- Mobile Sidebar ---- */

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

menuToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

globalSearch.addEventListener('input', () => {
  render();
});

navMenu.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    closeSidebar();
  });
});

window.addEventListener('hashchange', onHashChange);

/* ---- Init ---- */

async function init() {
  try {
    await loadData();
    route = parseHash();
    if (!route.id && route.section === 'npcs') {
      route.id = 'phil-miller';
      location.replace('#npcs/phil-miller');
    }
    updateNavActive();
    render();
  } catch (err) {
    contentArea.innerHTML = `
      <div class="error-panel">
        <h2>データの読み込みに失敗しました</h2>
        <p>ローカルで確認する場合は HTTP サーバー経由で開いてください。</p>
        <pre>${escapeHtml(err.message)}</pre>
      </div>
    `;
  }
}

init();
