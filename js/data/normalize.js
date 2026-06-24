/**
 * スプレッドシート行 / JSON をサイト共通モデルへ正規化
 * PL向け表示用 — 管理フィールドは除外
 */
window.ArchiveNormalize = (function () {
  const ADMIN_FIELD_KEYS = new Set([
    'edit_url', 'editUrl', 'form_response_id', 'formResponseId',
    'created_at', 'createdAt', 'updated_at', 'updatedAt',
    'memo', 'spreadsheet_url', 'spreadsheetUrl', 'gas_url', 'gasUrl',
    'drive_url', 'driveUrl', 'callback', 'pl_hidden', 'plHidden'
  ]);

  function stripAdminFields(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const clean = { ...raw };
    ADMIN_FIELD_KEYS.forEach(key => delete clean[key]);
    return clean;
  }

  const STATUS_MAP = {
    '生存': 'alive',
    '死亡': 'dead',
    '行方不明': 'missing',
    '不明': 'unknown',
    alive: 'alive',
    dead: 'dead',
    missing: 'missing',
    unknown: 'unknown'
  };

  function splitIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    return String(value)
      .split(/[,、|]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function isPlaceholderValue(value) {
    const t = String(value ?? '').trim();
    return !t || t === '未設定' || t === 'なし' || t === '—' || t === '-';
  }

  function splitIdList(value) {
    return splitIds(value).filter(id => !isPlaceholderValue(id));
  }

  function parseLocationField(value) {
    if (isPlaceholderValue(value)) return { locationIds: [], locationNames: [] };
    const parts = splitIds(value);
    const locationIds = parts.filter(p => /^loc-/i.test(p));
    const locationNames = parts.filter(p => !/^loc-/i.test(p));
    return { locationIds, locationNames };
  }

  function parseContactableField(value) {
    if (isPlaceholderValue(value)) return { contactablePcIds: [], contactablePcNames: [] };
    const parts = splitIdList(value);
    return {
      contactablePcIds: parts.filter(p => /^pc[-_]/i.test(p)),
      contactablePcNames: parts.filter(p => !/^pc[-_]/i.test(p))
    };
  }

  function parseRelatedNpcField(value) {
    if (isPlaceholderValue(value)) return { relatedNpcIds: [], relatedNpcNames: [] };
    const parsed = parseRelatedNpcs(value);
    const relatedNpcIds = [];
    const relatedNpcNames = [];
    parsed.forEach(entry => {
      if (/^npc[-_]/i.test(entry.npcId)) {
        relatedNpcIds.push(entry);
      } else {
        const label = entry.relation
          ? `${entry.npcId}（${entry.relation}）`
          : entry.npcId;
        relatedNpcNames.push(label);
      }
    });
    return { relatedNpcIds, relatedNpcNames };
  }

  function splitParagraphs(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value)
      .split(/\n{2,}|\r\n\r\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function parseJsonField(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function parsePersonField(value) {
    const parsed = parseJsonField(value, null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        family: parsed.family || parsed['家族'] || '',
        pet: parsed.pet || parsed['ペット'] || '',
        traits: parsed.traits || parsed['特徴'] || '',
        personality: parsed.personality || parsed['性格'] || ''
      };
    }
    if (typeof value === 'string' && value.trim()) {
      const text = value.trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        const parsed = parseJsonField(text, null);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            family: parsed.family || parsed['家族'] || '',
            pet: parsed.pet || parsed['ペット'] || '',
            traits: parsed.traits || parsed['特徴'] || '',
            personality: parsed.personality || parsed['性格'] || ''
          };
        }
      }
      // フォーム「人物情報」の自由記述 → 性格として表示
      return { family: '', pet: '', traits: '', personality: text };
    }
    return { family: '', pet: '', traits: '', personality: '' };
  }

  function parseEpisodes(value) {
    if (value == null || value === '') return [];
    if (isPlaceholderValue(value)) return [];

    const parsed = parseJsonField(value, null);
    if (Array.isArray(parsed)) {
      return parsed.map(ep => ({
        icon: ep.icon || '📌',
        title: ep.title || ep['タイトル'] || '',
        desc: ep.desc || ep.description || ep['説明'] || ''
      })).filter(ep => ep.title || ep.desc);
    }

    const text = String(value).trim();
    if (!text) return [];

    // フォームの自由記述（1行1件、「タイトル：説明」形式にも対応）
    return text.split(/\n+/).map(line => {
      line = line.trim();
      if (!line) return null;
      const m = line.match(/^(.+?)[：:]\s*(.+)$/);
      if (m) {
        return { icon: '📌', title: m[1].trim(), desc: m[2].trim() };
      }
      return { icon: '📌', title: line, desc: '' };
    }).filter(Boolean);
  }

  function parseRelatedNpcs(value) {
    if (isPlaceholderValue(value)) return [];
    const parsed = parseJsonField(value, []);
    if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'object') {
      return parsed.map(r => ({
        npcId: r.npcId || r.id,
        relation: r.relation || r['関係'] || ''
      })).filter(r => r.npcId);
    }
    return splitIds(value).filter(id => !isPlaceholderValue(id)).map(id => ({ npcId: id, relation: '' }));
  }

  function normalizeStatus(value) {
    return STATUS_MAP[value] || STATUS_MAP[String(value).trim()] || 'unknown';
  }

  function formatBirthDate(value) {
    if (!value) return '';
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}/${m}/${day}`;
      }
    }
    return str;
  }

  function isApiNpcFormat(raw) {
    return raw.birth_date !== undefined ||
      raw.birth_place !== undefined ||
      raw.occupation !== undefined ||
      raw.image_url !== undefined ||
      raw.profile !== undefined;
  }

  function mergeApiPersonFields(raw, person) {
    const pairs = [
      ['family', raw.family || raw.family_info || raw['家族']],
      ['pet', raw.pet || raw['ペット']],
      ['traits', raw.traits || raw.features || raw['特徴']],
      ['personality', raw.personality || raw['性格']]
    ];
    pairs.forEach(([key, value]) => {
      const text = value == null ? '' : String(value).trim();
      if (text && !person[key]) person[key] = text;
    });
    return person;
  }

  /** Apps Script API → 内部モデル（管理フィールドは含めない） */
  function normalizeNpcFromApi(raw) {
    raw = stripAdminFields(raw);
    let person = parsePersonField(raw.person || raw['人物']);
    person = mergeApiPersonFields(raw, person);
    const personality = String(
      raw.personality || raw['性格'] || person.personality || ''
    ).trim();
    const locations = parseLocationField(
      raw.location_ids || raw.locations || raw.locationIds || raw['関連場所']
    );
    const contactable = parseContactableField(
      raw.contactable_pc_ids || raw.contactable_pcs || raw.contactablePcIds || raw['連絡可能PC']
    );
    const relatedNpcs = parseRelatedNpcField(
      raw.related_npc_ids || raw.related_npcs || raw.relatedNpcIds || raw['関連NPC']
    );

    return {
      id: raw.id,
      name: raw.name || '',
      furigana: raw.furigana || '',
      nameEn: raw.nameEn || raw['英語名'] || '',
      birthdate: formatBirthDate(raw.birth_date || raw.birthdate || raw['生年月日']),
      age: raw.age ?? raw['年齢'] ?? '',
      nationality: raw.nationality || raw['国籍'] || '',
      origin: raw.birth_place || raw.origin || raw['出身地'] || '',
      job: raw.occupation || raw.job || raw['職業'] || '',
      organizationIds: splitIds(raw.organization_ids || raw.organizationIds || raw.organization_id),
      organizationNames: String(raw.organization_names || '').trim(),
      status: normalizeStatus(raw.status || raw['状態']),
      bio: splitParagraphs(raw.profile || raw.bio || raw['人物紹介']),
      personality,
      person,
      episodes: parseEpisodes(raw.episodes || raw['エピソード']),
      contactablePcIds: contactable.contactablePcIds,
      contactablePcNames: contactable.contactablePcNames,
      image: raw.image_url || raw.imageUrl || raw.image || raw['画像URL'] || '',
      avatar: raw.avatar || raw.avatar_url || raw['サムネイルURL'] || '',
      scenarioIds: splitIdList(
        raw.scenario_ids || raw.scenarios || raw.scenarioIds || raw['登場シナリオ']
      ),
      relatedNpcIds: relatedNpcs.relatedNpcIds,
      relatedNpcNames: relatedNpcs.relatedNpcNames,
      locationIds: locations.locationIds,
      locationNames: locations.locationNames
    };
  }

  /** スプレッドシート NPC 行 → 内部モデル */
  function normalizeNpcRow(row) {
    row = stripAdminFields(row);
    const person = parsePersonField(row['人物'] || row.person);
    const personality = String(row.personality || row['性格'] || person.personality || '').trim();
    const contactable = parseContactableField(row['連絡可能PC'] || row.contactablePcIds);
    const relatedNpcs = parseRelatedNpcField(row.relatedNpcIds || row['関連NPC']);
    const locations = parseLocationField(row.locationIds || row['関連場所']);
    return {
      id: row.id,
      name: row['名前'] || row.name || '',
      furigana: row['フリガナ'] || row.furigana || '',
      nameEn: row.nameEn || row['英語名'] || '',
      birthdate: row['生年月日'] || row.birthdate || '',
      age: row['年齢'] ?? row.age ?? '',
      nationality: row['国籍'] || row.nationality || '',
      origin: row['出身地'] || row.origin || '',
      job: row['職業'] || row.job || '',
      organizationIds: splitIds(row.organization_id || row.organizationIds || row['organization_id']),
      organizationNames: String(row.organization_names || '').trim(),
      status: normalizeStatus(row['状態'] || row.status),
      bio: splitParagraphs(row['人物紹介'] || row.bio || row.profile),
      personality,
      person,
      episodes: parseEpisodes(row['エピソード'] || row.episodes),
      contactablePcIds: contactable.contactablePcIds,
      contactablePcNames: contactable.contactablePcNames,
      image: row['画像URL'] || row.imageUrl || row.image || '',
      avatar: row.avatar || row['サムネイルURL'] || '',
      scenarioIds: splitIdList(row.scenarioIds || row['登場シナリオ']),
      relatedNpcIds: relatedNpcs.relatedNpcIds,
      relatedNpcNames: relatedNpcs.relatedNpcNames,
      locationIds: locations.locationIds,
      locationNames: locations.locationNames
    };
  }

  /** JSON / シート / API 双方 — 形式を自動判別 */
  function normalizeNpc(raw) {
    raw = stripAdminFields(raw);
    if (isApiNpcFormat(raw)) {
      return normalizeNpcFromApi(raw);
    }
    if (raw['名前'] || raw.organization_id !== undefined) {
      return normalizeNpcRow(raw);
    }
    const contactable = parseContactableField(raw.contactablePcIds);
    const relatedNpcs = parseRelatedNpcField(raw.relatedNpcIds);
    const locations = parseLocationField(raw.locationIds);
    return {
      id: raw.id,
      name: raw.name || '',
      furigana: raw.furigana || '',
      nameEn: raw.nameEn || '',
      birthdate: raw.birthdate || '',
      age: raw.age ?? '',
      nationality: raw.nationality || '',
      origin: raw.origin || '',
      job: raw.job || '',
      organizationIds: splitIds(raw.organizationIds),
      organizationNames: String(raw.organizationNames || '').trim(),
      status: normalizeStatus(raw.status),
      bio: splitParagraphs(raw.bio || raw.profile),
      personality: String(raw.personality || raw.person?.personality || '').trim(),
      person: parsePersonField(raw.person),
      episodes: parseEpisodes(raw.episodes),
      contactablePcIds: contactable.contactablePcIds,
      contactablePcNames: contactable.contactablePcNames,
      image: raw.image || '',
      avatar: raw.avatar || '',
      scenarioIds: splitIdList(raw.scenarioIds),
      relatedNpcIds: relatedNpcs.relatedNpcIds,
      relatedNpcNames: relatedNpcs.relatedNpcNames,
      locationIds: locations.locationIds,
      locationNames: locations.locationNames
    };
  }

  function normalizeOrganizationRow(row) {
    const summary = row['概要'] || row.summary || '';
    const descriptionText = row['説明'] || row.description || '';
    return {
      id: row.id,
      name: row['名称'] || row.name || '',
      nameEn: row.nameEn || '',
      icon: row.icon || '🏛️',
      summary,
      description: splitParagraphs(descriptionText),
      locationId: row.locationId || null,
      locationName: row['所在地'] || row.locationName || '',
      scenarioIds: splitIds(row.scenarioIds || row['関連シナリオ']),
      memberNpcNames: splitIds(row.memberNpcNames || row.member_npc_names || row['所属NPC']),
      memberNpcIds: splitIds(row.memberNpcIds || row.member_npc_ids)
    };
  }

  function isGarbageSheetValue(value) {
    return /\[?Ljava\.lang\.Object;@/i.test(String(value ?? ''));
  }

  function cleanOrgText(value) {
    let s = String(value ?? '').trim();
    if (isGarbageSheetValue(s)) return '';
    s = s.replace(/\[Ljava\.lang\.Object;@[a-f0-9]+\s*/gi, '').trim();
    s = s.replace(/Object;@[a-f0-9]+\s*/gi, '').trim();
    return s;
  }

  function cleanOrgIcon(value) {
    const s = cleanOrgText(value);
    if (!s) return '🏛️';
    if (/^https?:\/\//i.test(s)) {
      const m = s.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
      if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
      return s;
    }
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) {
      return `https://drive.google.com/uc?export=view&id=${s}`;
    }
    if (s.length <= 8) return s;
    return '🏛️';
  }

  function normalizeOrganization(raw) {
    raw = stripAdminFields(raw);
    if (raw['名称']) return normalizeOrganizationRow(raw);
    return {
      id: raw.id,
      name: cleanOrgText(raw.name),
      nameEn: raw.nameEn || '',
      icon: cleanOrgIcon(raw.icon),
      summary: cleanOrgText(raw.summary),
      description: splitParagraphs(cleanOrgText(raw.description) || raw.description),
      locationId: raw.locationId || raw.location_id || null,
      locationName: cleanOrgText(raw.location_name || raw.locationName),
      scenarioIds: splitIds(raw.scenarioIds || raw.scenario_ids),
      memberNpcNames: splitIds(raw.member_npc_names || raw.memberNpcNames),
      memberNpcIds: splitIds(raw.member_npc_ids || raw.memberNpcIds)
    };
  }

  function normalizeScenarioRow(row) {
    return {
      id: row.id,
      title: row['名称'] || row.title || '',
      era: row['年代'] || row.era || '',
      summary: row['概要'] || row.summary || '',
      npcIds: splitIds(row.npcIds || row['登場NPC']),
      organizationIds: splitIds(row.organizationIds || row['登場組織']),
      pcIds: splitIds(row.pcIds || row['関連PC']),
      relatedScenarioIds: splitIds(row.relatedScenarioIds || row['関連シナリオ'])
    };
  }

  function normalizeScenario(raw) {
    raw = stripAdminFields(raw);
    if (raw['名称'] && !raw.title) return normalizeScenarioRow(raw);
    return {
      id: raw.id,
      title: raw.title || '',
      era: raw.era || '',
      summary: raw.summary || '',
      npcIds: splitIds(raw.npcIds),
      organizationIds: splitIds(raw.organizationIds),
      pcIds: splitIds(raw.pcIds),
      relatedScenarioIds: splitIds(raw.relatedScenarioIds)
    };
  }

  function normalizePcRow(row) {
    return {
      id: row.id,
      name: row['名前'] || row.name || '',
      playerName: row['プレイヤー名'] || row.playerName || '',
      description: row['説明'] || row.description || '',
      affiliation: row.affiliation || row['所属'] || '',
      relatedNpcIds: splitIds(row.relatedNpcIds || row['関連NPC'])
    };
  }

  function normalizePc(raw) {
    raw = stripAdminFields(raw);
    if (raw['プレイヤー名'] !== undefined || raw['説明'] !== undefined) {
      return normalizePcRow(raw);
    }
    return {
      id: raw.id,
      name: raw.name || '',
      playerName: raw.playerName || '',
      description: raw.description || '',
      affiliation: raw.affiliation || '',
      relatedNpcIds: splitIds(raw.relatedNpcIds)
    };
  }

  function normalizeLocation(raw) {
    return {
      id: raw.id,
      name: raw.name || raw['名称'] || '',
      icon: raw.icon || '📍'
    };
  }

  /** 組織の所在地テキストから locations を補完 */
  function enrichLocations(organizations, locations) {
    const byName = new Map(locations.map(l => [l.name, l]));
    const result = [...locations];

    organizations.forEach(org => {
      if (!org.locationName || org.locationId) return;
      if (byName.has(org.locationName)) {
        org.locationId = byName.get(org.locationName).id;
        return;
      }
      const id = 'loc-' + org.id.replace(/^org-/, '');
      const loc = { id, name: org.locationName, icon: '📍' };
      result.push(loc);
      byName.set(org.locationName, loc);
      org.locationId = id;
    });

    return result;
  }

  function orgNameMatches(part, org) {
    const p = String(part || '').trim();
    const name = String(org.name || '').trim();
    if (!p || !name) return false;
    return name === p || p.includes(name) || name.includes(p);
  }

  /** 所属組織名から organizationIds を補完（ID 未設定の NPC 用） */
  function resolveOrganizationIdsForNpc(npc, organizations) {
    const ids = new Set((npc.organizationIds || []).filter(Boolean));
    splitIds(npc.organizationNames).forEach(part => {
      organizations.forEach(org => {
        if (orgNameMatches(part, org)) ids.add(org.id);
      });
    });
    return [...ids];
  }

  function linkNpcsToOrganizations(npcs, organizations) {
    return npcs.map(npc => ({
      ...npc,
      organizationIds: resolveOrganizationIdsForNpc(npc, organizations)
    }));
  }

  function buildIndexes(data) {
    const indexes = {
      npcById: new Map(),
      orgById: new Map(),
      scenarioById: new Map(),
      pcById: new Map(),
      locationById: new Map(),
      npcsByOrgId: new Map()
    };

    data.npcs.forEach(npc => indexes.npcById.set(npc.id, npc));
    data.organizations.forEach(org => indexes.orgById.set(org.id, org));
    data.scenarios.forEach(sc => indexes.scenarioById.set(sc.id, sc));
    data.pcs.forEach(pc => indexes.pcById.set(pc.id, pc));
    data.locations.forEach(loc => indexes.locationById.set(loc.id, loc));

    data.npcs.forEach(npc => {
      (npc.organizationIds || []).forEach(orgId => {
        if (!indexes.npcsByOrgId.has(orgId)) {
          indexes.npcsByOrgId.set(orgId, []);
        }
        indexes.npcsByOrgId.get(orgId).push(npc);
      });
    });

    data.organizations.forEach(org => {
      (org.memberNpcIds || []).forEach(npcId => {
        const npc = indexes.npcById.get(npcId);
        if (!npc) return;
        if (!indexes.npcsByOrgId.has(org.id)) {
          indexes.npcsByOrgId.set(org.id, []);
        }
        const members = indexes.npcsByOrgId.get(org.id);
        if (!members.some(m => m.id === npcId)) members.push(npc);
      });
    });

    indexes.npcsByOrgId.forEach(members => {
      members.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });

    return indexes;
  }

  function normalizeArchiveData(raw) {
    const organizations = (raw.organizations || []).map(normalizeOrganization);
    let locations = (raw.locations || []).map(normalizeLocation);
    locations = enrichLocations(organizations, locations);
    const npcs = linkNpcsToOrganizations(
      (raw.npcs || []).map(normalizeNpc),
      organizations
    );

    return {
      npcs,
      organizations,
      scenarios: (raw.scenarios || []).map(normalizeScenario),
      pcs: (raw.pcs || []).map(normalizePc),
      locations
    };
  }

  return {
    normalizeNpc,
    normalizeOrganization,
    normalizeScenario,
    normalizePc,
    normalizeArchiveData,
    buildIndexes,
    splitIds,
    parseJsonField
  };
})();
