/* ========================================
   YOKOFOLIA ふわっと住民台帳
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
  npcsByOrgId: new Map(),
  scenariosByNpcId: new Map(),
  scenariosByOrgId: new Map(),
  npcsByPcId: new Map(),
  scenariosByPcId: new Map()
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
  indexes.scenariosByNpcId = built.scenariosByNpcId;
  indexes.scenariosByOrgId = built.scenariosByOrgId;
  indexes.npcsByPcId = built.npcsByPcId;
  indexes.scenariosByPcId = built.scenariosByPcId;

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
  const emojiFallback = img.getAttribute('data-emoji-fallback');
  if (emojiFallback) {
    const span = document.createElement('span');
    span.className = 'org-icon-emoji';
    if (img.classList.contains('org-icon-img--detail')) {
      span.classList.add('org-icon-emoji--detail');
    }
    span.textContent = emojiFallback;
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

function pcPortraitImg(pc) {
  const svg = generatePortrait(pc.name, '#2a263a', '#e8487a');
  return renderImg(pc.image || '', svg, { className: 'detail-image', alt: pc.name });
}

function pcAvatarImg(pc) {
  const svg = generateAvatar(pc.name, '#2a263a', '#e8487a');
  return renderImg(pc.image || '', svg, { className: 'list-avatar', alt: pc.name });
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

function findOrgByNamePart(part) {
  const p = String(part || '').trim();
  if (!p) return null;
  return store.organizations.find(o =>
    o.name === p || p.includes(o.name) || o.name.includes(p)
  ) || null;
}

/** NPC に紐づく組織（ID・名前の両方から解決） */
function resolveNpcOrganizations(npc) {
  const seen = new Set();
  const orgs = [];

  (npc.organizationIds || []).forEach(id => {
    const org = indexes.orgById.get(id);
    if (org && !seen.has(org.id)) {
      seen.add(org.id);
      orgs.push(org);
    }
  });

  splitOrgNames(npc.organizationNames).forEach(part => {
    const org = findOrgByNamePart(part);
    if (org && !seen.has(org.id)) {
      seen.add(org.id);
      orgs.push(org);
    }
  });

  return orgs;
}

function resolveNpcUnlinkedOrgNames(npc) {
  return splitOrgNames(npc.organizationNames).filter(part => !findOrgByNamePart(part));
}

function resolveOrgsForNpc(npc) {
  return resolveNpcOrganizations(npc);
}

function resolveScenarios(ids) {
  return (ids || []).map(id => indexes.scenarioById.get(id)).filter(Boolean);
}

function mergeScenariosById(...lists) {
  const byId = new Map();
  lists.flat().forEach(sc => {
    if (sc?.id) byId.set(sc.id, sc);
  });
  return [...byId.values()].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
}

function scenariosForNpc(npc) {
  return mergeScenariosById(
    resolveScenarios(npc.scenarioIds),
    indexes.scenariosByNpcId.get(npc.id) || []
  );
}

function scenariosForOrg(org) {
  return mergeScenariosById(
    resolveScenarios(org.scenarioIds),
    indexes.scenariosByOrgId.get(org.id) || []
  );
}

function npcsForPc(pc) {
  return indexes.npcsByPcId.get(pc.id) || [];
}

function scenariosForPc(pc) {
  return indexes.scenariosByPcId.get(pc.id) || [];
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
  const hash = location.hash.slice(1) || 'home';
  const parts = hash.split('/').filter(Boolean);
  return { section: parts[0] || 'home', id: parts[1] || null };
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
  contentArea.scrollTop = 0;
}

const SITE_NAME = 'YOKOFOLIA ふわっと住民台帳';

function updateDocumentTitle() {
  const entity = getActiveEntity();
  const label = entity && (entity.name || entity.title);
  document.title = label
    ? `${label} — YOKOFOLIA`
    : SITE_NAME;
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

/* ---- Loading ---- */

const LOADING_MESSAGES = [
  '住民台帳を開いています…',
  '迷宮の地図を広げています…',
  '登場人物を呼び集めています…',
  'ふわっと同期中…'
];

let loadingMessageTimer = null;

function renderLoadingScreen() {
  contentArea.innerHTML = `
    <div class="portal-loading" role="status" aria-live="polite">
      <img src="images/yokofolia-mascot.png" alt="" class="portal-loading-mascot" width="96" height="96" decoding="async">
      <p class="portal-loading-brand">YOKOFOLIA</p>
      <p class="portal-loading-message" id="loadingMessage">${LOADING_MESSAGES[0]}</p>
      <div class="portal-loading-bar" aria-hidden="true"><span></span></div>
    </div>
  `;

  let index = 0;
  loadingMessageTimer = setInterval(() => {
    index = (index + 1) % LOADING_MESSAGES.length;
    const el = document.getElementById('loadingMessage');
    if (el) el.textContent = LOADING_MESSAGES[index];
  }, 2200);
}

function stopLoadingScreen() {
  if (loadingMessageTimer) {
    clearInterval(loadingMessageTimer);
    loadingMessageTimer = null;
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

function getFilesDriveUrl() {
  const url = String(window.AppLinks?.filesDriveFolder || '').trim();
  return url && url !== '#' ? url : '';
}

function getPcFormUrl() {
  const url = String(window.AppLinks?.pcForm || '').trim();
  return url && url !== '#' ? url : '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function defaultOrgEmoji(icon) {
  const value = String(icon || '').trim();
  if (!value || /\[?Ljava\.lang\.Object;@/i.test(value)) return '🏛️';
  if (/^https?:\/\//i.test(value)) return '🏛️';
  if (value.length <= 8) return value;
  return '🏛️';
}

function renderOrgIconImg(url, emoji, variant) {
  const utils = window.ImageUtils;
  const { src, fallbacks } = utils
    ? utils.buildImgAttrs(url, '')
    : { src: url, fallbacks: [] };
  const fallbacksEncoded = encodeURIComponent(JSON.stringify(fallbacks));
  const sizeClass = variant === 'detail' ? 'org-icon-img--detail' : 'org-icon-img--card';

  return `<img class="org-icon-img ${sizeClass}"` +
    ` src="${escapeAttr(src)}"` +
    ` alt=""` +
    ` loading="lazy"` +
    ` decoding="async"` +
    ` referrerpolicy="no-referrer"` +
    ` data-fallbacks="${fallbacksEncoded}"` +
    ` data-emoji-fallback="${escapeAttr(emoji)}"` +
    ` onerror="handleArchiveImgError(this)">`;
}

function renderOrgIcon(icon, { variant = 'card' } = {}) {
  const value = String(icon || '').trim();
  const emoji = defaultOrgEmoji(icon);
  const wrapClass = variant === 'detail' ? 'org-icon-wrap org-icon-wrap--detail' : 'org-icon-wrap org-icon-wrap--card';

  if (!value || /\[?Ljava\.lang\.Object;@/i.test(value)) {
    const emojiClass = variant === 'detail' ? 'org-icon-emoji org-icon-emoji--detail' : 'org-icon-emoji';
    return `<span class="${emojiClass}">${escapeHtml(emoji)}</span>`;
  }
  if (/^https?:\/\//i.test(value)) {
    return `<span class="${wrapClass}">${renderOrgIconImg(value, emoji, variant)}</span>`;
  }
  if (value.length > 8) {
    const emojiClass = variant === 'detail' ? 'org-icon-emoji org-icon-emoji--detail' : 'org-icon-emoji';
    return `<span class="${emojiClass}">${escapeHtml(emoji)}</span>`;
  }
  const emojiClass = variant === 'detail' ? 'org-icon-emoji org-icon-emoji--detail' : 'org-icon-emoji';
  return `<span class="${emojiClass}">${escapeHtml(value)}</span>`;
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

function renderDetailSection(heading, bodyHtml, { alwaysShow = false } = {}) {
  const hasBody = bodyHtml && String(bodyHtml).trim();
  if (!hasBody && !alwaysShow) return '';
  const inner = hasBody ? bodyHtml : renderEmpty();
  return `
    <section class="detail-section">
      <h2 class="section-heading">${escapeHtml(heading)}</h2>
      ${inner}
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

function renderRelatedBlock(title, innerHtml, { alwaysShow = false } = {}) {
  const hasBody = innerHtml && String(innerHtml).trim();
  if (!hasBody && !alwaysShow) return '';
  const inner = hasBody ? innerHtml : renderEmpty();
  return `<div class="related-block"><h3>${escapeHtml(title)}</h3>${inner}</div>`;
}

function renderContactableContent(npc) {
  const contactablePcs = resolvePcs(npc.contactablePcIds);
  const items = [
    ...contactablePcs.map(pc =>
      renderLink(`#pcs/${pc.id}`, pc.name, pc.playerName)
    ),
    ...(npc.contactablePcNames || []).map(name =>
      `<span class="contact-name">${escapeHtml(name)}</span>`
    )
  ];
  if (!items.length) return '';
  return renderLinkList(items);
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
    scenariosForNpc(npc).map(sc =>
      renderLink(`#scenarios/${sc.id}`, sc.title, sc.era)
    )
  );
  const npcLinks = renderLinkListIfAny(
    (npc.relatedNpcIds || []).map(r => {
      const id = typeof r === 'string' ? r : r.npcId;
      const relation = typeof r === 'object' ? (r.relation || '') : '';
      const rel = indexes.npcById.get(id);
      return rel ? renderLink(`#npcs/${rel.id}`, rel.name, relation) : '';
    }).filter(Boolean)
  );
  const npcNameList = (npc.relatedNpcNames || []).length
    ? `<ul class="link-list">${npc.relatedNpcNames.map(name =>
        `<li><span class="contact-name">${escapeHtml(name)}</span></li>`
      ).join('')}</ul>`
    : '';
  const npcLinksCombined = [npcLinks, npcNameList].filter(Boolean).join('') || '';
  const locations = resolveLocations(npc.locationIds);
  let locationHtml = '';
  if (locations.length) {
    locationHtml = `<ul class="link-list">${locations.map(loc =>
      `<li><span class="location-item">${loc.icon || '📍'} ${escapeHtml(loc.name)}</span></li>`
    ).join('')}</ul>`;
  } else if (npc.locationNames?.length) {
    locationHtml = `<ul class="link-list">${npc.locationNames.map(name =>
      `<li><span class="location-item">📍 ${escapeHtml(name)}</span></li>`
    ).join('')}</ul>`;
  }

  const blocks = [
    renderRelatedBlock('所属組織', renderNpcOrgRelatedContent(npc), { alwaysShow: true }),
    renderRelatedBlock('登場シナリオ', scenarioLinks, { alwaysShow: true }),
    renderRelatedBlock('関連NPC', npcLinksCombined, { alwaysShow: true }),
    renderRelatedBlock('関連場所', locationHtml, { alwaysShow: true })
  ].join('');

  return renderDetailSection('関連情報', `<div class="related-grid">${blocks}</div>`, { alwaysShow: true });
}

function renderListLayout(listHtml, detailHtml) {
  const detailOpen = Boolean(route.id);
  const layoutClass = detailOpen
    ? 'entity-layout entity-layout--detail'
    : 'entity-layout';
  const backBtn = detailOpen ? `
    <button type="button" class="mobile-detail-back" data-mobile-back="${escapeAttr(route.section)}">
      ← 一覧に戻る
    </button>
  ` : '';

  return `
    <div class="${layoutClass}">
      <div class="list-panel">${listHtml}</div>
      <div class="detail-panel">${backBtn}${detailHtml}</div>
    </div>
  `;
}

function renderLinkList(items) {
  if (!items.length) return renderEmpty();
  return `<ul class="link-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function renderOrgMemberRow(org) {
  return `
    <li class="member-row" data-nav-section="organizations" data-nav-id="${org.id}">
      <span class="member-row-icon">${renderOrgIcon(org.icon, { variant: 'card' })}</span>
      <div class="member-info">
        <span class="member-name">${escapeHtml(org.name)}</span>
        ${org.summary ? `<span class="member-sub">${escapeHtml(org.summary)}</span>` : ''}
      </div>
    </li>
  `;
}

function renderNpcOrgRelatedContent(npc) {
  const orgs = resolveNpcOrganizations(npc);
  const unlinked = resolveNpcUnlinkedOrgNames(npc);
  if (!orgs.length && !unlinked.length) return '';

  const rows = [
    ...orgs.map(org => renderOrgMemberRow(org)),
    ...unlinked.map(name => `
      <li class="member-row member-row--static">
        <span class="member-row-icon org-icon-emoji" aria-hidden="true">🏛️</span>
        <div class="member-info">
          <span class="member-name">${escapeHtml(name)}</span>
        </div>
      </li>
    `)
  ];
  return `<ul class="member-list member-list--org">${rows.join('')}</ul>`;
}

function renderNpcOrgDisplay(npc) {
  const orgs = resolveNpcOrganizations(npc);
  if (orgs.length) {
    return orgs.map(o => renderLink(`#organizations/${o.id}`, o.name)).join('、');
  }
  const unlinked = resolveNpcUnlinkedOrgNames(npc);
  if (unlinked.length) {
    return unlinked.map(name => escapeHtml(name)).join('、');
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

  contentArea.querySelectorAll('a.entity-link[href^="#"]').forEach(el => {
    el.addEventListener('click', e => {
      const href = el.getAttribute('href') || '';
      const parts = href.slice(1).split('/').filter(Boolean);
      if (!parts.length) return;
      e.preventDefault();
      navigate(parts[0], parts[1] || null);
      closeSidebar();
    });
  });

  contentArea.querySelectorAll('[data-mobile-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.mobileBack, null);
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
  // スマホは #npcs だけのとき一覧のみ（詳細はタップ後）
  if (!isMobileListLayout()) {
    return fallbackId || filtered[0]?.id || null;
  }
  return fallbackId || null;
}

function isMobileListLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

/* ---- Portal Home ---- */

function renderPortalStatCard({ section, icon, label, count, sub }) {
  return `
    <a href="#${section}" class="stat-card" data-nav-section="${section}">
      <span class="stat-card-icon" aria-hidden="true">${icon}</span>
      <span class="stat-card-label">${escapeHtml(label)}</span>
      <span class="stat-card-divider" aria-hidden="true"></span>
      <span class="stat-card-value">${count}</span>
      <span class="stat-card-sub">${escapeHtml(sub)}</span>
    </a>
  `;
}

const DISCORD_LOGO_SVG = `<svg class="community-logo-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;

const COMMUNITY_LINKS = [
  {
    key: 'cocofolia',
    name: 'ココフォリア',
    desc: 'ブラウザでサラッと遊べるオンラインセッションツール',
    logoClass: 'community-logo--cocofolia',
    logoHtml: '<span class="community-logo-mark community-logo-mark--cocofolia" aria-hidden="true"></span><span class="community-logo-word">CCFOLIA</span>'
  },
  {
    key: 'iachara',
    name: 'いあきゃら',
    desc: 'クトゥルフ神話TRPGのキャラクターシートを簡単作成',
    logoClass: 'community-logo--iachara',
    logoHtml: '<span class="community-logo-word community-logo-word--iachara">いあきゃら</span>'
  },
  {
    key: 'discord',
    name: 'Discord',
    desc: '猫TRPG公式サーバーで質問や要望ができます',
    logoClass: 'community-logo--discord',
    logoHtml: `${DISCORD_LOGO_SVG}<span class="community-logo-word community-logo-word--discord">Discord</span>`
  }
];

function renderCommunityCard(item) {
  const url = (window.AppLinks || {})[item.key] || '#';
  const isReady = url && url !== '#';
  if (!isReady) {
    return `
      <div class="community-card community-card--disabled">
        <div class="community-logo ${item.logoClass}">${item.logoHtml}</div>
        <p class="community-name">${escapeHtml(item.name)}</p>
        <p class="community-desc">${escapeHtml(item.desc)}</p>
      </div>
    `;
  }
  return `
    <a href="${escapeAttr(url)}" class="community-card" target="_blank" rel="noopener noreferrer">
      <div class="community-logo ${item.logoClass}">${item.logoHtml}</div>
      <p class="community-name">${escapeHtml(item.name)}</p>
      <p class="community-desc">${escapeHtml(item.desc)}</p>
    </a>
  `;
}

function renderPortalMinigameCard(game) {
  return `
    <a href="${escapeAttr(game.href)}" class="portal-minigame-card">
      <span class="portal-minigame-icon" aria-hidden="true">${escapeHtml(game.icon || '🎮')}</span>
      <span class="portal-minigame-body">
        <span class="portal-minigame-name">${escapeHtml(game.name || '')}</span>
        <span class="portal-minigame-desc">${escapeHtml(game.description || '')}</span>
      </span>
      <span class="portal-minigame-go" aria-hidden="true">→</span>
    </a>
  `;
}

function formatNewsDate(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length < 3) return iso;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function renderPortalNewsSection() {
  const items = (window.AppLinks && window.AppLinks.portalNews) || [];
  if (!items.length) return '';
  return `
      <section class="portal-section">
        <h2 class="portal-section-label">更新のお知らせ</h2>
        <ul class="portal-news-list">
          ${items.map(item => {
            const href = String(item.href || '').trim();
            const inner = `
              <span class="portal-news-date">${escapeHtml(formatNewsDate(item.date))}</span>
              <span class="portal-news-body">
                <span class="portal-news-title">${escapeHtml(item.title || '')}</span>
                ${item.text ? `<span class="portal-news-text">${escapeHtml(item.text)}</span>` : ''}
              </span>
              ${href ? '<span class="portal-news-go" aria-hidden="true">→</span>' : ''}
            `;
            return href
              ? `<li><a href="${escapeAttr(href)}" class="portal-news-item">${inner}</a></li>`
              : `<li><div class="portal-news-item portal-news-item--static">${inner}</div></li>`;
          }).join('')}
        </ul>
      </section>
  `;
}

function renderPortalMinigameSection() {
  const games = (window.AppLinks && window.AppLinks.portalMinigames) || [];
  if (!games.length) return '';
  return `
      <section class="portal-section">
        <h2 class="portal-section-label">オマケ</h2>
        <div class="portal-minigame-list">
          ${games.map(renderPortalMinigameCard).join('')}
        </div>
      </section>
  `;
}

function renderHomeView() {
  const stats = [
    { section: 'npcs', icon: '🧑‍🤝‍🧑', label: 'NPC', count: store.npcs.length, sub: '登録済み' },
    { section: 'organizations', icon: '🏛️', label: 'ORGANIZATION', count: store.organizations.length, sub: '組織' },
    { section: 'scenarios', icon: '📜', label: 'SCENARIO', count: store.scenarios.length, sub: 'シナリオ' },
    { section: 'pcs', icon: '👤', label: 'PLAYER', count: store.pcs.length, sub: 'PC' }
  ];

  const externalLinks = COMMUNITY_LINKS;

  contentArea.innerHTML = `
    <div class="portal-page">
      <section class="portal-hero">
        <img src="images/yokofolia-mascot.png" alt="" class="portal-hero-mascot" width="120" height="120" decoding="async">
        <div class="portal-hero-body">
          <p class="portal-hero-kicker">TRPG WORLD PORTAL</p>
          <h1 class="portal-hero-title">ふわっと住民台帳</h1>
          <p class="portal-hero-lead">この世界に暮らす人々・組織・物語を、ひとつの場所から辿れるアーカイブ。</p>
        </div>
      </section>

      ${renderPortalNewsSection()}

      <section class="portal-section">
        <h2 class="portal-section-label">本日の台帳</h2>
        <div class="portal-stats">
          ${stats.map(renderPortalStatCard).join('')}
        </div>
      </section>

      <section class="portal-section">
        <h2 class="portal-section-label">探索する</h2>
        <div class="portal-explore">
          <a href="#npcs" class="portal-explore-card" data-nav-section="npcs">
            <span class="portal-explore-icon">🧑‍🤝‍🧑</span>
            <span class="portal-explore-name">NPC</span>
            <span class="portal-explore-desc">登場人物のプロフィールとエピソード</span>
          </a>
          <a href="#organizations" class="portal-explore-card" data-nav-section="organizations">
            <span class="portal-explore-icon">🏛️</span>
            <span class="portal-explore-name">組織</span>
            <span class="portal-explore-desc">勢力・結社とそのメンバー</span>
          </a>
          <a href="#scenarios" class="portal-explore-card" data-nav-section="scenarios">
            <span class="portal-explore-icon">📜</span>
            <span class="portal-explore-name">シナリオ</span>
            <span class="portal-explore-desc">物語の記録と関連情報</span>
          </a>
          <a href="#pcs" class="portal-explore-card" data-nav-section="pcs">
            <span class="portal-explore-icon">👤</span>
            <span class="portal-explore-name">PC</span>
            <span class="portal-explore-desc">プレイヤーキャラクター一覧</span>
          </a>
          <a href="#files" class="portal-explore-card" data-nav-section="files">
            <span class="portal-explore-icon">📁</span>
            <span class="portal-explore-name">資料</span>
            <span class="portal-explore-desc">ハンドアウト・画像など（Google ドライブ）</span>
          </a>
        </div>
      </section>

      ${renderPortalMinigameSection()}

      <section class="portal-section portal-section--community">
        <h2 class="portal-community-title">コミュニティ</h2>
        <div class="community-grid">
          ${externalLinks.map(renderCommunityCard).join('')}
        </div>
      </section>
    </div>
  `;

  bindNavigation();
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
            ${ep.desc ? `<p>${escapeHtml(ep.desc)}</p>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const contactableHtml = renderContactableContent(npc);

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
      ${renderDetailSection('連絡可能PC', contactableHtml, { alwaysShow: true })}
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
      <span class="org-card-icon">${renderOrgIcon(org.icon, { variant: 'card' })}</span>
      <h3 class="org-card-name">${escapeHtml(org.name)}</h3>
      <p class="org-card-summary">${escapeHtml(org.summary || '')}</p>
      <p class="org-card-meta">所属NPC ${members.length} 名${preview ? ` — ${preview}` : ''}</p>
    </article>
  `;
}

function renderOrgDetail(org) {
  const members = orgMembers(org.id);
  const scenarios = scenariosForOrg(org);
  const location = org.locationId ? indexes.locationById.get(org.locationId) : null;
  const locationLabel = location ? `${location.icon || '📍'} ${location.name}` : (org.locationName ? `📍 ${org.locationName}` : '');
  const descriptionOnly = (org.description || []).filter(Boolean);

  return `
    <article class="entity-detail entity-detail--org">
      <header class="detail-header detail-header--org">
        <div class="detail-org-icon">${renderOrgIcon(org.icon, { variant: 'detail' })}</div>
        <div class="detail-header-body">
          <h1 class="detail-title">${escapeHtml(org.name)}</h1>
          ${org.nameEn ? `<p class="detail-meta">${escapeHtml(org.nameEn)}</p>` : ''}
          ${org.summary ? `<p class="detail-summary">${escapeHtml(org.summary)}</p>` : ''}
          ${locationLabel ? `<p class="detail-meta detail-meta--location">${escapeHtml(locationLabel)}</p>` : ''}
          ${String(org.editUrl || '').trim() ? `
            <div class="pc-detail-actions">
              <a href="${escapeAttr(org.editUrl)}" class="file-open-btn file-open-btn--secondary" target="_blank" rel="noopener noreferrer">
                登録内容を編集
              </a>
            </div>
          ` : ''}
        </div>
      </header>

      ${descriptionOnly.length ? `
      <section class="detail-section">
        <h2 class="section-heading">説明</h2>
        <div class="prose">
          ${descriptionOnly.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      </section>
      ` : ''}

      <section class="detail-section">
        <h2 class="section-heading">所属NPC <span class="section-count">${members.length}</span></h2>
        ${members.length ? `
          <ul class="member-list member-list--org">
            ${members.map(npc => renderNpcMemberRow(npc)).join('')}
          </ul>
        ` : renderEmpty('所属NPCは登録されていません')}
      </section>

      <section class="detail-section detail-section--compact">
        <h2 class="section-heading">関連情報</h2>
        <div class="related-grid">
          ${renderRelatedBlock(
            '関連シナリオ',
            scenarios.length
              ? renderLinkList(scenarios.map(sc => renderLink(`#scenarios/${sc.id}`, sc.title, sc.era)))
              : '',
            { alwaysShow: true }
          )}
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

const MIGO_TITLE_LABELS = (window.MigoCosmetics && window.MigoCosmetics.TITLE_LABELS) || {
  'title-whisper': '囁きの観測者',
  'title-migo': '菌類の取引人'
};

const MIGO_COSMETIC_META = (window.MigoCosmetics && window.MigoCosmetics.META) || {
  'frame-fungal': { emoji: '🍄', label: 'ユゴス菌糸', slot: '枠' },
  'frame-bone': { emoji: '🦴', label: '地球製骨片', slot: '枠' },
  'frame-ether': { emoji: '🛸', label: 'エーテル結晶', slot: '枠' },
  'frame-migo-wing': { emoji: '🦇', label: 'ミ＝ゴの翼', slot: '枠' },
  'bg-nebula': { emoji: '☄️', label: '隕石片', slot: '背景' },
  'bg-void': { emoji: '🌑', label: '暗黒の欠片', slot: '背景' },
  'title-whisper': { emoji: '📼', label: '禁断フィルム', slot: '称号' },
  'title-migo': { emoji: '🔗', label: '鉤爪の欠片', slot: '称号' },
  'fx-glimpse': { emoji: '👁', label: '第三の眼', slot: '光' }
};

const MIGO_COSMETIC_SLOT = (window.MigoCosmetics && window.MigoCosmetics.SLOT) || {
  'frame-fungal': 'frame',
  'frame-bone': 'frame',
  'frame-ether': 'frame',
  'frame-migo-wing': 'frame',
  'bg-nebula': 'bg',
  'bg-void': 'bg',
  'title-whisper': 'title',
  'title-migo': 'title',
  'fx-glimpse': 'fx'
};

const MIGO_COMP_ID = (window.MigoCosmetics && window.MigoCosmetics.COMP_ID) || 'frame-migo-wing';
const MIGO_COMP_TITLE = (window.MigoCosmetics && window.MigoCosmetics.COMP_TITLE_LABEL) || '深淵を飾る者';

function pcIsMigoComplete(pc) {
  return (pc.cosmetics || []).indexOf(MIGO_COMP_ID) >= 0;
}

function pickActiveMigoCosmetics_(cosmeticIds) {
  const ids = cosmeticIds || [];
  const latestBySlot = {};
  ids.forEach(id => {
    const slot = MIGO_COSMETIC_SLOT[id];
    if (slot) latestBySlot[slot] = id;
  });
  const active = Object.keys(latestBySlot).map(slot => latestBySlot[slot]);
  if (ids.indexOf('frame-migo-wing') >= 0) active.push('frame-migo-wing');
  return active.filter((id, i, arr) => arr.indexOf(id) === i);
}

function pcCosmeticClasses(pc) {
  const ids = pickActiveMigoCosmetics_(pc.cosmetics || []);
  const classes = ['pc-cosme'];
  ids.forEach(id => {
    if (id) classes.push(`pc-cosme--${id}`);
  });
  if ((pc.cosmetics || []).indexOf('frame-migo-wing') >= 0) {
    classes.push('pc-cosme--complete');
  }
  return classes.join(' ');
}

function pcCosmeticTitle(pc) {
  const active = pickActiveMigoCosmetics_(pc.cosmetics || []);
  for (let i = active.length - 1; i >= 0; i--) {
    const label = MIGO_TITLE_LABELS[active[i]];
    if (label) return label;
  }
  return '';
}

function renderPcPortraitBlock(pc, isComplete) {
  const img = pcPortraitImg(pc);
  if (!isComplete) return img;
  return `
    <div class="pc-complete-portrait-frame">
      <div class="pc-complete-portrait-wrap">${img}</div>
    </div>`;
}

function renderCompRewardCard(unlocked) {
  const meta = (window.MigoCosmetics && window.MigoCosmetics.META) || MIGO_COSMETIC_META;
  const comp = meta[MIGO_COMP_ID] || { emoji: '🦇', label: 'ミ＝ゴの翼', slot: '枠' };
  return `
    <div class="cosmetic-comp-reward${unlocked ? ' is-unlocked' : ''}">
      <h3 class="cosmetic-comp-reward__heading">コンプリート報酬</h3>
      <div class="cosmetic-comp-reward__card">
        <div class="cosmetic-comp-reward__emblem" aria-hidden="true">
          <span class="cosmetic-comp-reward__emblem-icon">${comp.emoji}</span>
        </div>
        <div class="cosmetic-comp-reward__body">
          <p class="cosmetic-comp-reward__name">
            ${escapeHtml(comp.label)}
            <span class="cosmetic-comp-reward__slot">${escapeHtml(comp.slot)}</span>
          </p>
          <p class="cosmetic-comp-reward__desc">全カテゴリの菌糸コスメ収集の証</p>
        </div>
      </div>
    </div>`;
}

function renderPcDetailTitleBlock(pc, title, isComplete) {
  if (isComplete) {
    const subTitle = title && title !== MIGO_COMP_TITLE ? title : '';
    return `
          <h1 class="detail-title pc-complete-title-block">${escapeHtml(pc.name)}</h1>
          <span class="complete-title-badge">${escapeHtml(MIGO_COMP_TITLE)}</span>
          ${subTitle ? `<span class="pc-cosme-title pc-cosme-title--sub">${escapeHtml(subTitle)}</span>` : ''}`;
  }
  return `
          <h1 class="detail-title">${escapeHtml(pc.name)}${title ? `<span class="pc-cosme-title pc-cosme-title--detail">${escapeHtml(title)}</span>` : ''}</h1>`;
}

function renderPcCosmeticsSection(pc) {
  const ids = (pc.cosmetics || []).filter(Boolean);
  if (!ids.length) return '';

  if (pcIsMigoComplete(pc)) {
    const meta = (window.MigoCosmetics && window.MigoCosmetics.META) || MIGO_COSMETIC_META;
    const baseIds = (window.MigoCosmetics && window.MigoCosmetics.BASE_IDS) || [];
    const owned = new Set(ids);
    const catalogItems = baseIds.map((id, index) => {
      const itemMeta = meta[id] || { emoji: '✨', label: id, slot: '' };
      const isOwned = owned.has(id);
      return `<li class="cosmetic-catalog-item${isOwned ? ' is-owned' : ' is-missing'}" style="--catalog-i: ${index}" title="${escapeAttr(itemMeta.label)}">
        <span class="cosmetic-catalog-emoji" aria-hidden="true">${itemMeta.emoji}</span>
        <span class="cosmetic-catalog-label">${escapeHtml(itemMeta.label)}</span>
        <span class="cosmetic-catalog-slot">${escapeHtml(itemMeta.slot || '')}</span>
      </li>`;
    }).join('');
    return `
      <section class="detail-section pc-cosme-section pc-cosme-section--complete">
        <h2 class="section-heading">菌糸コスメ</h2>
        <p class="detail-meta pc-cosme-lead pc-cosme-lead--complete">ミ＝ゴキャッチャーの景品コレクション（全20種）。台帳の装飾は各スロット（枠・背景・称号・光）の<strong>最新</strong>が反映されます。</p>
        <ul class="cosmetic-catalog-grid">${catalogItems}</ul>
        ${renderCompRewardCard(owned.has(MIGO_COMP_ID))}
      </section>
    `;
  }

  const chips = ids.map(id => {
    const itemMeta = MIGO_COSMETIC_META[id] || { emoji: '✨', label: id, slot: '' };
    return `<li class="pc-cosme-chip" title="${escapeAttr(itemMeta.label)}">
      <span class="pc-cosme-chip-emoji" aria-hidden="true">${itemMeta.emoji}</span>
      <span class="pc-cosme-chip-label">${escapeHtml(itemMeta.label)}</span>
      ${itemMeta.slot ? `<span class="pc-cosme-chip-slot">${escapeHtml(itemMeta.slot)}</span>` : ''}
    </li>`;
  }).join('');
  return `
      <section class="detail-section pc-cosme-section">
        <h2 class="section-heading">菌糸コスメ</h2>
        <p class="detail-meta pc-cosme-lead">ミ＝ゴキャッチャーの景品コレクション（全20種+コンプ）。台帳の装飾は各スロット（枠・背景・称号・光）の<strong>最新</strong>が反映されます。</p>
        <ul class="pc-cosme-chips">${chips}</ul>
      </section>
  `;
}

function renderPcListItem(pc, active) {
  const cosmeClass = pcCosmeticClasses(pc);
  const title = pcCosmeticTitle(pc);
  return `
    <li class="list-item ${active ? 'active' : ''} ${cosmeClass}"
        data-nav-section="pcs"
        data-nav-id="${pc.id}"
        role="option">
      ${pcAvatarImg(pc)}
      <div class="list-item-info">
        <div class="list-item-name">${escapeHtml(pc.name)}${title ? `<span class="pc-cosme-title">${escapeHtml(title)}</span>` : ''}</div>
        <div class="list-item-sub">${escapeHtml(pc.playerName || '')}</div>
      </div>
    </li>
  `;
}

function renderPcDetail(pc) {
  const relatedNpcs = npcsForPc(pc);
  const scenarios = scenariosForPc(pc);
  const sheetUrl = String(pc.sheetUrl || '').trim();
  const cosmeClass = pcCosmeticClasses(pc);
  const title = pcCosmeticTitle(pc);
  const isComplete = pcIsMigoComplete(pc);

  return `
    <article class="entity-detail ${cosmeClass}${isComplete ? ' pc-full-complete' : ''}">
      ${isComplete ? `
      <div class="pc-complete-stage">
        <div class="pc-complete-card">
          <header class="detail-header pc-complete-hero pc-complete-hero--stacked">
            ${renderPcPortraitBlock(pc, true)}
            <div class="detail-header-body pc-complete-identity">
              ${renderPcDetailTitleBlock(pc, title, true)}
              <p class="detail-meta pc-complete-player">プレイヤー：${escapeHtml(pc.playerName || '—')}</p>
            </div>
          </header>
          ${renderPcCosmeticsSection(pc)}
        </div>
      </div>
      ` : `
      <header class="detail-header">
        ${renderPcPortraitBlock(pc, false)}
        <div class="detail-header-body">
          ${renderPcDetailTitleBlock(pc, title, false)}
          <p class="detail-meta">プレイヤー：${escapeHtml(pc.playerName || '—')}</p>
        </div>
      </header>

      ${renderPcCosmeticsSection(pc)}
      `}

      <section class="detail-section">
        <h2 class="section-heading">キャラクターシート</h2>
        <div class="pc-detail-actions">
          ${sheetUrl ? `
            <a href="${escapeAttr(sheetUrl)}" class="file-open-btn" target="_blank" rel="noopener noreferrer">
              キャラシを開く
            </a>
          ` : `<p class="detail-meta">キャラシ URL が未登録です。</p>`}
          ${String(pc.editUrl || '').trim() ? `
            <a href="${escapeAttr(pc.editUrl)}" class="file-open-btn file-open-btn--secondary" target="_blank" rel="noopener noreferrer">
              登録内容を編集
            </a>
          ` : ''}
        </div>
      </section>

      ${pc.description ? `
      <section class="detail-section">
        <h2 class="section-heading">説明</h2>
        <div class="prose"><p>${escapeHtml(pc.description)}</p></div>
      </section>
      ` : ''}

      ${pc.affiliation ? `
      <section class="detail-section detail-section--compact">
        <h2 class="section-heading">所属</h2>
        <p>${escapeHtml(pc.affiliation)}</p>
      </section>
      ` : ''}

      <section class="detail-section">
        <h2 class="section-heading">連絡可能NPC</h2>
        ${relatedNpcs.length ? `
          <ul class="member-list member-list--compact">
            ${relatedNpcs.map(npc => renderNpcMemberRow(npc)).join('')}
          </ul>
        ` : renderEmpty('NPCフォームの「連絡可能PC」から自動で表示されます')}
      </section>

      <section class="detail-section">
        <h2 class="section-heading">関連シナリオ</h2>
        ${scenarios.length
          ? renderLinkList(scenarios.map(sc => renderLink(`#scenarios/${sc.id}`, sc.title, sc.era)))
          : renderEmpty('シナリオフォームの「関連PC」から自動で表示されます')}
      </section>
    </article>
  `;
}

function renderPcsView() {
  const query = getSearchQuery();
  const filtered = filterPcs(query);
  const activeId = getActiveId(filtered);
  const activePc = activeId ? indexes.pcById.get(activeId) : null;
  const pcFormUrl = getPcFormUrl();

  const registerHtml = pcFormUrl ? `
    <div class="pc-register-banner">
      <p class="pc-register-lead">自分の PC を台帳に登録できます（PC名・プレイヤー名・キャラシURL）。</p>
      <a href="${escapeAttr(pcFormUrl)}" class="file-open-btn" target="_blank" rel="noopener noreferrer">
        PCを登録する
      </a>
    </div>
  ` : '';

  const listHtml = `
    <div class="panel-header">
      <h2 class="panel-title">PC</h2>
      <span class="panel-count">${filtered.length} 件</span>
    </div>
    ${registerHtml}
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

/* ---- Files (Google Drive) ---- */

function renderFilesView() {
  const driveUrl = getFilesDriveUrl();

  contentArea.innerHTML = `
    <div class="files-drive-page">
      <section class="files-drive-hero">
        <span class="files-drive-icon" aria-hidden="true">📁</span>
        <h1 class="files-drive-title">資料</h1>
        <p class="files-drive-lead">
          ハンドアウト・地図・画像などの配布資料は Google ドライブにまとめています。
          フォルダ内のファイルを開いて閲覧・ダウンロードできます。
        </p>
      </section>
      <section class="files-drive-actions">
        ${driveUrl ? `
          <a href="${escapeAttr(driveUrl)}" class="file-open-btn" target="_blank" rel="noopener noreferrer">
            資料フォルダを開く
          </a>
          <p class="files-drive-note">Google ドライブが新しいタブで開きます。</p>
        ` : `
          <p class="empty-note">資料フォルダの URL が未設定です。<br>KP にお問い合わせください。</p>
        `}
      </section>
    </div>
  `;
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
    case 'home':
      renderHomeView();
      break;
    case 'organizations':
      renderOrganizationsView();
      break;
    case 'scenarios':
      renderScenariosView();
      break;
    case 'pcs':
      renderPcsView();
      break;
    case 'files':
      renderFilesView();
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

  const notices = (loadMeta.notices || []).filter(notice => {
    if (notice.level === 'warning') return false;
    if (notice.level !== 'error') return false;
    if (loadMeta.npcSource === 'api' && loadMeta.scenarioSource === 'json-fallback') {
      return false;
    }
    if (loadMeta.npcSource === 'api' && loadMeta.pcSource === 'json-fallback') {
      return false;
    }
    return true;
  });

  if (!notices.length) return;

  const banner = document.createElement('div');
  banner.id = 'noticeBanner';
  banner.className = 'notice-banner';

  banner.innerHTML = notices.map(notice => {
    const isFallback = loadMeta.npcSource === 'json-fallback';
    const title = notice.title || (isFallback
      ? '最新データを読み込めませんでした'
      : 'データの読み込みに問題が発生しました');
    const message = notice.message || (isFallback
      ? '表示されている NPC 情報が最新でない場合があります。しばらくしてから再度お試しください。'
      : 'しばらくしてからページを再読み込みしてください。');

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

window.matchMedia('(max-width: 768px)').addEventListener('change', () => {
  if (route.section !== 'home' && route.section !== 'files' && route.section !== 'search') {
    render();
  }
});

/* ---- Init ---- */

async function init() {
  renderLoadingScreen();
  try {
    await loadData();
    stopLoadingScreen();
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
    stopLoadingScreen();
    console.error('[TRPG Archive]', err);
    renderFatalError(err);
  }
}

init();
