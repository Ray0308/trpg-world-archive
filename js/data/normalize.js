/**
 * スプレッドシート行 / JSON をサイト共通モデルへ正規化
 * PL向け表示用 — 管理フィールドは除外
 */
window.ArchiveNormalize = (function () {
  const ADMIN_FIELD_KEYS = new Set([
    'edit_url', 'editUrl', 'form_response_id', 'formResponseId',
    'created_at', 'createdAt', 'updated_at', 'updatedAt',
    'memo', 'spreadsheet_url', 'spreadsheetUrl', 'gas_url', 'gasUrl',
    'drive_url', 'driveUrl', 'callback'
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
      return { family: value.trim(), pet: '', traits: '', personality: '' };
    }
    return { family: '', pet: '', traits: '', personality: '' };
  }

  function parseEpisodes(value) {
    const parsed = parseJsonField(value, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(ep => ({
      icon: ep.icon || '📌',
      title: ep.title || ep['タイトル'] || '',
      desc: ep.desc || ep.description || ep['説明'] || ''
    }));
  }

  function parseRelatedNpcs(value) {
    const parsed = parseJsonField(value, []);
    if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'object') {
      return parsed.map(r => ({
        npcId: r.npcId || r.id,
        relation: r.relation || r['関係'] || ''
      })).filter(r => r.npcId);
    }
    return splitIds(value).map(id => ({ npcId: id, relation: '' }));
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

  /** Apps Script API → 内部モデル（管理フィールドは含めない） */
  function normalizeNpcFromApi(raw) {
    raw = stripAdminFields(raw);
    const person = parsePersonField(raw.person || raw['人物']);
    const personality = raw.personality || raw['性格'] || '';
    if (personality && !person.personality) {
      person.personality = String(personality).trim();
    }

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
      person,
      episodes: parseEpisodes(raw.episodes || raw['エピソード']),
      contactablePcIds: splitIds(raw.contactable_pc_ids || raw.contactablePcIds || raw['連絡可能PC']),
      image: raw.image_url || raw.imageUrl || raw.image || '',
      avatar: raw.avatar || raw['サムネイルURL'] || '',
      scenarioIds: splitIds(raw.scenario_ids || raw.scenarioIds || raw['登場シナリオ']),
      relatedNpcIds: parseRelatedNpcs(raw.related_npc_ids || raw.relatedNpcIds || raw['関連NPC']),
      locationIds: splitIds(raw.location_ids || raw.locationIds || raw['関連場所'])
    };
  }

  /** スプレッドシート NPC 行 → 内部モデル */
  function normalizeNpcRow(row) {
    row = stripAdminFields(row);
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
      bio: splitParagraphs(row['人物紹介'] || row.bio),
      person: parsePersonField(row['人物'] || row.person),
      episodes: parseEpisodes(row['エピソード'] || row.episodes),
      contactablePcIds: splitIds(row['連絡可能PC'] || row.contactablePcIds),
      image: row['画像URL'] || row.imageUrl || row.image || '',
      avatar: row.avatar || row['サムネイルURL'] || '',
      scenarioIds: splitIds(row.scenarioIds || row['登場シナリオ']),
      relatedNpcIds: parseRelatedNpcs(row.relatedNpcIds || row['関連NPC']),
      locationIds: splitIds(row.locationIds || row['関連場所'])
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
      bio: splitParagraphs(raw.bio),
      person: parsePersonField(raw.person),
      episodes: parseEpisodes(raw.episodes),
      contactablePcIds: splitIds(raw.contactablePcIds),
      image: raw.image || '',
      avatar: raw.avatar || '',
      scenarioIds: splitIds(raw.scenarioIds),
      relatedNpcIds: parseRelatedNpcs(raw.relatedNpcIds),
      locationIds: splitIds(raw.locationIds)
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
      scenarioIds: splitIds(row.scenarioIds || row['関連シナリオ'])
    };
  }

  function normalizeOrganization(raw) {
    raw = stripAdminFields(raw);
    if (raw['名称']) return normalizeOrganizationRow(raw);
    return {
      id: raw.id,
      name: raw.name || '',
      nameEn: raw.nameEn || '',
      icon: raw.icon || '🏛️',
      summary: raw.summary || '',
      description: splitParagraphs(raw.description),
      locationId: raw.locationId || null,
      locationName: raw.locationName || '',
      scenarioIds: splitIds(raw.scenarioIds)
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

    indexes.npcsByOrgId.forEach(members => {
      members.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });

    return indexes;
  }

  function normalizeArchiveData(raw) {
    const organizations = (raw.organizations || []).map(normalizeOrganization);
    let locations = (raw.locations || []).map(normalizeLocation);
    locations = enrichLocations(organizations, locations);

    return {
      npcs: (raw.npcs || []).map(normalizeNpc),
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
