/* ========================================
   TRPG World Archive v0.2
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
let loadMeta = { npcSource: '', notices: [] };

const contentArea = document.getElementById('contentArea');
const globalSearch = document.getElementById('globalSearch');
const navMenu = document.getElementById('navMenu');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuToggle = document.getElementById('menuToggle');
const sidebarClose = document.getElementById('sidebarClose');

/* ---- Data Loading (provider 経由) ---- */

async function loadData() {
  const { data, indexes: built, meta } = await window.loadArchiveData();
  store.npcs = data.npcs;
  store.organizations = data.organizations;
  store.scenarios = data.scenarios;
  store.pcs = data.pcs;
  store.locations = data.locations;

  indexes.npcById = built.npcById;
  indexes.orgById = built.orgById;
  indexes.scenarioById = built.scenarioById;
  indexes.pcById = built.pcById;
  indexes.locationById = built.locationById;
  indexes.npcsByOrgId = built.npcsByOrgId;

  loadMeta = meta || { npcSource: '', notices: [] };
}

/* ---- Image Helpers ---- */

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

function npcPortraitFallback(npc) {
  return generatePortrait(npc.name);
}

function npcAvatarFallback(npc) {
  return generateAvatar(npc.name);
}

window.handleArchiveImgError = function (img) {
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

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function renderImg(url, svgFallback, { className = '', alt = '' } = {}) {
  const utils = window.ImageUtils;
  const { src, fallbacks } = utils
    ? utils.buildImgAttrs(url, svgFallback)
    : { src: url || svgFallback, fallbacks: [] };

  const fallbacksEncoded = encodeURIComponent(JSON.stringify(fallbacks));
  const svgEncoded = encodeURIComponent(svgFallback);

  return `<img class="${escapeHtml(className)}"` +
    ` src="${escapeAttr(src)}"` +
    ` alt="${escapeHtml(alt)}"` +
    ` loading="eager"` +
    ` decoding="async"` +
    ` referrerpolicy="no-referrer"` +
    ` data-fallbacks="${fallbacksEncoded}"` +
    ` data-svg-fallback="${svgEncoded}"` +
    ` onerror="handleArchiveImgError(this)">`;
}

function npcPortraitImg(npc) {
  const svg = npcPortraitFallback(npc);
  return renderImg(npc.image || '', svg, { className: 'detail-image', alt: npc.name });
}

function npcAvatarImg(npc) {
  const svg = npcAvatarFallback(npc);
  return renderImg(npc.avatar || npc.image || '', svg, { className: 'list-avatar', alt: npc.name });
}

/* ---- Entity Resolution ---- */

function resolveNpcs(ids) {
  return (ids || []).map(id => indexes.npcById.get(id)).filter(Boolean);
}

function resolveOrgs(ids) {
  return (ids || []).map(id => indexes.orgById.get(id)).filter(Boolean);
}

function splitOrgNames(text) {
  return String(text || '')
    .split(/[,、|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function resolveOrgsForNpc(npc) {
  const byId = resolveOrgs(npc.organizationIds);
  if (byId.length) return byId;
  const names = splitOrgNames(npc.organizationNames);
  const matched = [];
  names.forEach(part => {
    const org = store.organizations.find(o =>
      o.name === part || part.includes(o.name) || o.name.includes(part)
    );
    if (org && !matched.some(item => item.id === org.id)) matched.push(org);
  });
  return matched;
}

function resolveScenarios(ids) {
  return (ids || []).map(id => indexes.scenarioById.get(id)).filter(Boolean);
}

function resolvePcs(ids) {
  return (ids || []).map(id => indexes.pcById.get(id)).filter(Boolean);
}

function resolveLocations(ids) {
  return (ids || []).map(id => indexes.locationById.get(id)).filter(Boolean);
}

function orgMembers(orgId) {
  return indexes.npcsByOrgId.get(orgId) || [];
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
  renderNoticeBanner();
  scrollDetailToTop();
}

function updateNavActive() {
  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === route.section);
  });
}

function scrollDetailToTop() {
  const panel = contentArea.querySelector('.detail-panel');
  if (panel) panel.scrollTop = 0;
}

function updateDocumentTitle() {
  const entity = getActiveEntity();
  document.title = entity
    ? `${entity.name} — TRPG World Archive`
    : 'TRPG World Archive';
}

function getActiveEntity() {
  if (!route.id) return null;
  switch (route.section) {
    case 'npcs': return indexes.npcById.get(route.id);
    case 'organizations': return indexes.orgById.get(route.id);
    case 'scenarios': return indexes.scenarioById.get(route.id);
    case 'pcs': return indexes.pcById.get(route.id);
    default: return null;
  }
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
    matchesQuery(org.summary, query) ||
    (org.description || []).some(d => matchesQuery(d, query))
  );
}

function filterScenarios(query) {
  return store.scenarios.filter(sc =>
    matchesQuery(sc.title, query) ||
    matchesQuery(sc.summary, query) ||
    matchesQuery(sc.era, query)
  );
}

function filterPcs(query) {
  return store.pcs.filter(pc =>
    matchesQuery(pc.name, query) ||
    matchesQuery(pc.playerName, query) ||
    matchesQuery(pc.affiliation, query)
  );
}

/* ---- Render Helpers ---- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderLink(href, label, sub = '') {
  return `<a href="${href}" class="entity-link">${escapeHtml(label)}${sub ? `<span class="link-sub">${escapeHtml(sub)}</span>` : ''}</a>`;
}

function renderEmpty(message = 'なし') {
  return `<p class="empty-note">${message}</p>`;
}

function isPresent(value) {
  if (value == null) return false;
  if (typeof value === 'string') {
    const t = value.trim();
    return t !== '' && t !== '—' && t !== 'なし';
  }
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function renderDetailSection(heading, bodyHtml) {
  if (!bodyHtml || !String(bodyHtml).trim()) return '';
  return `
    <section class="detail-section">
      <h2 class="section-heading">${escapeHtml(heading)}</h2>
      ${bodyHtml}
    </section>
  `;
}

function renderInfoRow(label, valueHtml) {
  if (!isPresent(valueHtml)) return '';
  return `<div class="info-row"><dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
}

function renderLinkListIfAny(items) {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  return renderLinkList(list);
}

function renderRelatedBlock(title, innerHtml) {
  if (!innerHtml || !String(innerHtml).trim()) return '';
  return `<div class="related-block"><h3>${escapeHtml(title)}</h3>${innerHtml}</div>`;
}

function hasNpcOrgInfo(npc) {
  return resolveOrgsForNpc(npc).length > 0 || isPresent(npc.organizationNames);
}

function renderNpcPersonSection(npc) {
  const p = npc.person || {};
  const rows = [
    renderInfoRow('家族', escapeHtml(p.family || '')),
    renderInfoRow('ペット', escapeHtml(p.pet || '')),
    renderInfoRow('特徴', escapeHtml(p.traits || ''))
  ].filter(Boolean);

  if (!rows.length) return '';
  return renderDetailSection('人物', `<dl class="info-grid info-grid--compact">${rows.join('')}</dl>`);
}

function renderNpcPersonalitySection(npc) {
  const text = npc.personality || '';
  if (!isPresent(text)) return '';
  const html = splitParagraphs(text).map(p => `<p>${escapeHtml(p)}</p>`).join('');
  return renderDetailSection('性格', `<div class="prose">${html}</div>`);
}

function splitParagraphs(text) {
  if (!text) return [];
  return String(text)
    .split(/\n{2,}|\r\n\r\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function renderNpcRelatedSection(npc) {
  const scenarioLinks = renderLinkListIfAny(
    resolveScenarios(npc.scenarioIds).map(sc =>
      renderLink(`#scenarios/${sc.id}`, sc.title, sc.era)
    )
  );
  const npcLinks = renderLinkListIfAny(
    (npc.relatedNpcIds || []).map(r => {
      const rel = indexes.npcById.get(r.npcId);
      return rel ? renderLink(`#npcs/${rel.id}`, rel.name, r.relation) : '';
    })
  );
  const locations = resolveLocations(npc.locationIds);
  const locationHtml = locations.length
    ? `<ul class="link-list">${locations.map(loc =>
        `<li><span class="location-item">${loc.icon || '📍'} ${escapeHtml(loc.name)}</span></li>`
      ).join('')}</ul>`
    : '';

  const blocks = [
    renderRelatedBlock('登場シナリオ', scenarioLinks),
    renderRelatedBlock('関連NPC', npcLinks),
    renderRelatedBlock('関連場所', locationHtml)
  ].filter(Boolean).join('');

  if (!blocks) return '';
  return renderDetailSection('関連情報', `<div class="related-grid">${blocks}</div>`);
}

function renderListLayout(listHtml, detailHtml) {
  return `
    <div class="list-panel">${listHtml}</div>
    <div class="detail-panel">${detailHtml}</div>
  `;
}

function renderLinkList(items) {
  if (!items.length) return renderEmpty();
  return `<ul class="link-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function renderNpcOrgDisplay(npc) {
  const orgs = resolveOrgsForNpc(npc);
  if (orgs.length) {
    return orgs.map(o => renderLink(`#organizations/${o.id}`, o.name)).join('、');
  }
  const names = splitOrgNames(npc.organizationNames);
  if (names.length) {
    return names.map(name => escapeHtml(name)).join('、');
  }
  return '';
}

function renderNpcMemberRow(npc) {
  return `
    <li class="member-row" data-nav-section="npcs" data-nav-id="${npc.id}">
      ${npcAvatarImg(npc)}
      <div class="member-info">
        <span class="member-name">${escapeHtml(npc.name)}</span>
        <span class="member-sub">${escapeHtml(npc.job)}</span>
      </div>
      <span class="list-item-badge ${STATUS_CLASSES[npc.status]}">${STATUS_LABELS[npc.status]}</span>
    </li>
  `;
}

function bindNavigation() {
  contentArea.querySelectorAll('[data-nav-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.navSection, el.dataset.navId);
      closeSidebar();
    });
  });
}

function getActiveId(filtered, fallbackId) {
  if (route.id && filtered.some(item => item.id === route.id)) {
    return route.id;
  }
  // URL に古い ID（ローカル JSON の phil-miller 等）が残っている場合は先頭へ
  if (route.id && filtered.length > 0) {
    return filtered[0].id;
  }
  return fallbackId || filtered[0]?.id || null;
}

/* ---- NPC Views ---- */

function renderNpcListItem(npc, active) {
  return `
    <li class="list-item ${active ? 'active' : ''}"
        data-nav-section="npcs"
        data-nav-id="${npc.id}"
        role="option"
        aria-selected="${active}">
      ${npcAvatarImg(npc)}
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(npc.name)}</div>
        <div class="list-item-sub">${escapeHtml(npc.job)}</div>
      </div>
      <span class="list-item-badge ${STATUS_CLASSES[npc.status]}">${STATUS_LABELS[npc.status]}</span>
    </li>
  `;
}

function renderNpcDetail(npc) {
  const orgLinks = renderNpcOrgDisplay(npc);
  const contactablePcs = resolvePcs(npc.contactablePcIds);
  const bioHtml = (npc.bio || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');

  const headerRows = [
    renderInfoRow('生年月日', escapeHtml(npc.birthdate || '')),
    renderInfoRow('年齢', escapeHtml(String(npc.age ?? ''))),
    renderInfoRow('国籍', escapeHtml(npc.nationality || '')),
    renderInfoRow('出身地', escapeHtml(npc.origin || '')),
    renderInfoRow('職業', escapeHtml(npc.job || '')),
    hasNpcOrgInfo(npc) ? renderInfoRow('所属組織', `<span class="info-links">${orgLinks}</span>`) : '',
    renderInfoRow('状態', `<span class="badge ${STATUS_CLASSES[npc.status]}">${STATUS_LABELS[npc.status]}</span>`)
  ].filter(Boolean).join('');

  const episodesHtml = npc.episodes?.length ? `
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
  ` : '';

  const contactableHtml = contactablePcs.length
    ? renderLinkList(contactablePcs.map(pc =>
        renderLink(`#pcs/${pc.id}`, pc.name, pc.playerName)
      ))
    : '';

  return `
    <article class="entity-detail">
      <header class="detail-header">
        ${npcPortraitImg(npc)}
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(npc.name)}</h1>
          ${isPresent(npc.furigana) ? `<p class="detail-furigana">${escapeHtml(npc.furigana)}</p>` : ''}
          <dl class="info-grid">${headerRows}</dl>
        </div>
      </header>

      ${renderDetailSection('人物紹介', bioHtml ? `<div class="prose">${bioHtml}</div>` : '')}
      ${renderNpcPersonalitySection(npc)}
      ${renderNpcPersonSection(npc)}
      ${renderDetailSection('エピソード', episodesHtml)}
      ${renderDetailSection('連絡可能PC', contactableHtml)}
      ${renderNpcRelatedSection(npc)}
    </article>
  `;
}

function renderNpcsView() {
  const query = getSearchQuery();
  const filtered = filterNpcs(query);
  const activeId = getActiveId(filtered);
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
  bindNavigation();
}

/* ---- Organization Views ---- */

function renderOrgCard(org, active) {
  const members = orgMembers(org.id);
  const preview = members.slice(0, 3).map(n => escapeHtml(n.name)).join('、');
  return `
    <article class="org-card ${active ? 'active' : ''}"
             data-nav-section="organizations"
             data-nav-id="${org.id}">
      <span class="org-card-icon">${org.icon || '🏛️'}</span>
      <h3 class="org-card-name">${escapeHtml(org.name)}</h3>
      <p class="org-card-summary">${escapeHtml(org.summary || '')}</p>
      <p class="org-card-meta">所属NPC ${members.length} 名${preview ? ` — ${preview}` : ''}</p>
    </article>
  `;
}

function renderOrgDetail(org) {
  const members = orgMembers(org.id);
  const scenarios = resolveScenarios(org.scenarioIds);
  const location = org.locationId ? indexes.locationById.get(org.locationId) : null;

  return `
    <article class="entity-detail">
      <header class="detail-header detail-header--compact">
        <span class="detail-org-icon">${org.icon || '🏛️'}</span>
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(org.name)}</h1>
          ${org.nameEn ? `<p class="detail-meta">${escapeHtml(org.nameEn)}</p>` : ''}
        </div>
      </header>

      <section class="detail-section">
        <h2 class="section-heading">説明</h2>
        <div class="prose">
          ${org.summary ? `<p>${escapeHtml(org.summary)}</p>` : ''}
          ${(org.description || []).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
          ${!org.summary && !(org.description || []).length ? renderEmpty() : ''}
        </div>
      </section>

      ${location ? `
      <section class="detail-section">
        <h2 class="section-heading">所在地</h2>
        <p class="location-item">${location.icon || '📍'} ${escapeHtml(location.name)}</p>
      </section>
      ` : ''}

      <section class="detail-section">
        <h2 class="section-heading">所属NPC</h2>
        ${members.length ? `
          <ul class="member-list">
            ${members.map(npc => renderNpcMemberRow(npc)).join('')}
          </ul>
        ` : renderEmpty('所属NPCは登録されていません')}
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連情報</h2>
        <div class="related-grid">
          <div class="related-block">
            <h3>関連シナリオ</h3>
            ${renderLinkList(
              scenarios.map(sc => renderLink(`#scenarios/${sc.id}`, sc.title, sc.era))
            )}
          </div>
        </div>
      </section>
    </article>
  `;
}

function renderOrganizationsView() {
  const query = getSearchQuery();
  const filtered = filterOrganizations(query);
  const activeId = getActiveId(filtered);
  const activeOrg = activeId ? indexes.orgById.get(activeId) : null;

  const listHtml = `
    <div class="panel-header">
      <h2 class="panel-title">組織</h2>
      <span class="panel-count">${filtered.length} 件</span>
    </div>
    <div class="org-card-list">
      ${filtered.map(org => renderOrgCard(org, org.id === activeId)).join('')}
    </div>
  `;

  const detailHtml = activeOrg
    ? renderOrgDetail(activeOrg)
    : `<div class="detail-empty"><p>組織が見つかりません</p></div>`;

  contentArea.innerHTML = renderListLayout(listHtml, detailHtml);
  bindNavigation();
}

/* ---- Scenario Views ---- */

function renderScenarioListItem(sc, active) {
  const npcCount = (sc.npcIds || []).length;
  return `
    <li class="list-item ${active ? 'active' : ''}"
        data-nav-section="scenarios"
        data-nav-id="${sc.id}"
        role="option">
      <span class="list-icon">📜</span>
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(sc.title)}</div>
        <div class="list-item-sub">${escapeHtml(sc.era || '')} · NPC ${npcCount} 名</div>
      </div>
    </li>
  `;
}

function renderScenarioDetail(sc) {
  const npcs = resolveNpcs(sc.npcIds);
  const orgs = resolveOrgs(sc.organizationIds);
  const pcs = resolvePcs(sc.pcIds);
  const related = resolveScenarios(sc.relatedScenarioIds);

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
              <ul class="member-list member-list--compact">
                ${npcs.map(npc => renderNpcMemberRow(npc)).join('')}
              </ul>
            ` : renderEmpty()}
          </div>
          <div class="related-block">
            <h3>登場組織</h3>
            ${renderLinkList(
              orgs.map(o => renderLink(`#organizations/${o.id}`, o.name))
            )}
          </div>
          <div class="related-block">
            <h3>関連PC</h3>
            ${renderLinkList(
              pcs.map(pc => renderLink(`#pcs/${pc.id}`, pc.name, pc.affiliation))
            )}
          </div>
          <div class="related-block">
            <h3>関連シナリオ</h3>
            ${renderLinkList(
              related.map(r => renderLink(`#scenarios/${r.id}`, r.title, r.era))
            )}
          </div>
        </div>
      </section>
    </article>
  `;
}

function renderScenariosView() {
  const query = getSearchQuery();
  const filtered = filterScenarios(query);
  const activeId = getActiveId(filtered);
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
  bindNavigation();
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
  const relatedNpcs = resolveNpcs(pc.relatedNpcIds);
  const scenarios = store.scenarios.filter(sc =>
    (sc.pcIds || []).includes(pc.id)
  );

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
          <div class="info-row"><dt>プレイヤー名</dt><dd>${escapeHtml(pc.playerName || '—')}</dd></div>
          <div class="info-row"><dt>所属</dt><dd>${escapeHtml(pc.affiliation || '—')}</dd></div>
        </dl>
      </section>

      ${pc.description ? `
      <section class="detail-section">
        <h2 class="section-heading">説明</h2>
        <div class="prose"><p>${escapeHtml(pc.description)}</p></div>
      </section>
      ` : ''}

      <section class="detail-section">
        <h2 class="section-heading">関連NPC</h2>
        ${relatedNpcs.length ? `
          <ul class="member-list member-list--compact">
            ${relatedNpcs.map(npc => renderNpcMemberRow(npc)).join('')}
          </ul>
        ` : renderEmpty()}
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連シナリオ</h2>
        ${renderLinkList(
          scenarios.map(sc => renderLink(`#scenarios/${sc.id}`, sc.title, sc.era))
        )}
      </section>
    </article>
  `;
}

function renderPcsView() {
  const query = getSearchQuery();
  const filtered = filterPcs(query);
  const activeId = getActiveId(filtered);
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
  bindNavigation();
}

/* ---- Global Search Results ---- */

function renderGlobalSearchResults() {
  const query = getSearchQuery();
  if (!query) {
    render();
    return;
  }

  const results = {
    npcs: filterNpcs(query),
    organizations: filterOrganizations(query),
    scenarios: filterScenarios(query),
    pcs: filterPcs(query)
  };

  const total = results.npcs.length + results.organizations.length +
    results.scenarios.length + results.pcs.length;

  const section = (title, items, sectionName, renderItem) => {
    if (!items.length) return '';
    return `
      <section class="search-section">
        <h2 class="section-heading">${title}（${items.length}）</h2>
        <ul class="search-results">${items.map(item => renderItem(item)).join('')}</ul>
      </section>
    `;
  };

  contentArea.innerHTML = `
    <div class="search-results-panel">
      <h1 class="search-results-title">「${escapeHtml(query)}」の検索結果</h1>
      <p class="search-results-count">${total} 件</p>
      ${section('NPC', results.npcs, 'npcs', npc => `
        <li class="search-result-item" data-nav-section="npcs" data-nav-id="${npc.id}">
          ${npcAvatarImg(npc)}
          <div><strong>${escapeHtml(npc.name)}</strong><span>${escapeHtml(npc.job)}</span></div>
        </li>
      `)}
      ${section('組織', results.organizations, 'organizations', org => `
        <li class="search-result-item" data-nav-section="organizations" data-nav-id="${org.id}">
          <span class="list-icon">${org.icon || '🏛️'}</span>
          <div><strong>${escapeHtml(org.name)}</strong><span>${escapeHtml(org.summary || '')}</span></div>
        </li>
      `)}
      ${section('シナリオ', results.scenarios, 'scenarios', sc => `
        <li class="search-result-item" data-nav-section="scenarios" data-nav-id="${sc.id}">
          <span class="list-icon">📜</span>
          <div><strong>${escapeHtml(sc.title)}</strong><span>${escapeHtml(sc.era || '')}</span></div>
        </li>
      `)}
      ${section('PC', results.pcs, 'pcs', pc => `
        <li class="search-result-item" data-nav-section="pcs" data-nav-id="${pc.id}">
          <span class="list-icon">👤</span>
          <div><strong>${escapeHtml(pc.name)}</strong><span>${escapeHtml(pc.playerName || '')}</span></div>
        </li>
      `)}
      ${total === 0 ? renderEmpty('該当する項目がありません') : ''}
    </div>
  `;

  bindNavigation();
  updateDocumentTitle();
}

/* ---- Main Render ---- */

function render() {
  if (getSearchQuery()) {
    renderGlobalSearchResults();
    return;
  }

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

  updateDocumentTitle();
}

/* ---- Notices & Errors (PL向け — 管理情報は表示しない) ---- */

function renderNoticeBanner() {
  const existing = document.getElementById('noticeBanner');
  if (existing) existing.remove();

  if (!loadMeta.notices?.length) return;

  const banner = document.createElement('div');
  banner.id = 'noticeBanner';
  banner.className = 'notice-banner';

  banner.innerHTML = loadMeta.notices.map(() => {
    const isFallback = loadMeta.npcSource === 'json-fallback';
    const title = isFallback
      ? '最新データを読み込めませんでした'
      : 'お知らせ';
    const message = isFallback
      ? '表示されている NPC 情報が最新でない場合があります。しばらくしてから再度お試しください。'
      : 'データの読み込みに問題が発生しました。';

    return `
      <div class="notice-item notice-warning">
        <p class="notice-title">${escapeHtml(title)}</p>
        <p class="notice-message">${escapeHtml(message)}</p>
      </div>
    `;
  }).join('');

  const header = document.querySelector('.header');
  if (header) {
    header.insertAdjacentElement('afterend', banner);
  }
}

function renderFatalError(err) {
  contentArea.innerHTML = `
    <div class="error-panel">
      <h2>データの読み込みに失敗しました</h2>
      <p class="error-message">世界観データを表示できません。しばらくしてからページを再読み込みしてください。</p>
      <p class="error-hint">問題が続く場合は KP にお問い合わせください。</p>
    </div>
  `;
  console.error('[TRPG Archive]', err);
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

globalSearch.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    globalSearch.value = '';
    render();
  }
});

navMenu.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    globalSearch.value = '';
    closeSidebar();
  });
});

window.addEventListener('hashchange', onHashChange);

/* ---- Init ---- */

async function init() {
  try {
    await loadData();
    route = parseHash();
    renderNoticeBanner();
    if (!route.id && route.section === 'npcs' && store.npcs.length > 0) {
      location.replace(`#npcs/${store.npcs[0].id}`);
      return;
    }
    if (route.section === 'npcs' && store.npcs.length === 0) {
      contentArea.innerHTML = `
        <div class="error-panel">
          <h2>NPC データがありません</h2>
          <p class="error-message">登録されている NPC がまだありません。</p>
        </div>
      `;
      return;
    }
    updateNavActive();
    render();
  } catch (err) {
    console.error('[TRPG Archive]', err);
    renderFatalError(err);
  }
}

init();
