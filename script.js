/* ========================================
   TRPG World Archive — NPC Data & UI
   ======================================== */

const NPC_DATA = [
  {
    id: 'phil-miller',
    name: 'フィル・ミラー',
    nameEn: 'Phil Miller',
    job: '考古学者',
    affiliation: 'ミスカトニック大学',
    status: 'alive',
    important: true,
    avatar: generateAvatar('フィル', '#2d5a3d', '#4a9eff'),
    image: generatePortrait('フィル', '#1a3a2a', '#c9a84c'),
    birthdate: '1892/03/15',
    origin: 'アメリカ・マサチューセッツ州',
    age: 58,
    gender: '男性',
    nationality: 'アメリカ合衆国',
    language: '英語、日本語',
    pet: 'ゴールデンレトリバー「ダイナ」',
    san: '65 / 99',
    skills: '考古学 80%、歴史 65%、乗馬 55%',
    notes: '常に鞭を携帯している',
    bio: [
      '製材所を営む父と数学学者の母を持つ。幼少期より祖父に連れられ世界中の発掘現場を訪れる。',
      'ミスカトニック大学卒業後、世界各地で発掘活動を行い数々の賞を受賞。その後日本に移住し日本考古学協会賞も受賞している。',
      '穏やかな物腰だが、学術的な議論になると途端に饒舌になる。特に先カンブリア紀の化石に関しては誰にも負けない情熱を持つ。'
    ],
    episodes: [
      {
        icon: '🦴',
        title: '化石破壊事件',
        desc: 'ミスカトニック大学の保管庫で貴重な三葉虫化石が破壊された事件。フィルは真犯人を突き止め、大学の名誉を守った。'
      },
      {
        icon: '🪢',
        title: '鞭へのこだわり',
        desc: '幼い頃に読んだ冒険小説の影響で、いつも鞭を携帯している。実戦で使ったことは一度もないが、「いざという時のために」と主張している。'
      },
      {
        icon: '🦛',
        title: 'カバ恐怖症',
        desc: 'アフリカでの発掘中にカバに襲われた経験があり、以降カバの映像すら見られなくなった。動物園の前を通る際は遠回りする。'
      }
    ],
    scenarios: [
      { title: '失われた都', date: '2023/08/15' },
      { title: '黒き潮騒', date: '2024/01/22' },
      { title: '黄衣の招待状', date: '2024/05/12' }
    ],
    relatedNpcs: [
      { name: 'タティス・ミラー博士', relation: '祖父 / 古生物学者', avatar: generateAvatar('タティス', '#3d2d5a', '#a78bfa') }
    ],
    organizations: [
      { name: 'ミスカトニック大学', role: '名誉教授', icon: '🏛️' },
      { name: '日本考古学協会', role: '会員', icon: '🔬' }
    ],
    locations: [
      { name: 'ミスカトニック大学・考古学博物館', icon: '🏛️' },
      { name: 'アーカム・ミラー邸', icon: '🏠' },
      { name: '京都・地下遺跡', icon: '🗺️' }
    ]
  },
  {
    id: 'tatis-miller',
    name: 'タティス・ミラー博士',
    nameEn: 'Dr. Tatis Miller',
    job: '古生物学者',
    affiliation: 'ミスカトニック大学',
    status: 'dead',
    important: true,
    avatar: generateAvatar('タティス', '#3d2d5a', '#a78bfa'),
    image: generatePortrait('タティス', '#2a1a3a', '#8b7ec8'),
    birthdate: '1860/07/22',
    origin: 'イギリス・ロンドン',
    age: '享年 78歳',
    gender: '男性',
    nationality: 'イギリス→アメリカ',
    language: '英語、ラテン語',
    pet: 'なし',
    san: '—',
    skills: '古生物学 90%、地質学 75%',
    notes: '孫フィルに考古学を教えた',
    bio: [
      'イギリス生まれの天才古生物学者。若くしてアメリカに渡り、ミスカトニック大学の考古学部を創設した伝説的人物。',
      '孫のフィルを幼い頃から発掘現場に連れて回り、考古学への道を開いた。晩年は隠居し、貴重な化石コレクションを孫に託した。'
    ],
    episodes: [
      {
        icon: '🦕',
        title: '恐竜化石の発見',
        desc: 'モンタナ州で当時としては画期的な恐竜化石を発見。学術界に大きな衝撃を与えた。'
      },
      {
        icon: '📚',
        title: '最後の講義',
        desc: '引退前の最後の講義「地球の記憶を読む」は今もミスカトニック大学で語り継がれている。'
      }
    ],
    scenarios: [
      { title: '黄衣の招待状', date: '2024/05/12' }
    ],
    relatedNpcs: [
      { name: 'フィル・ミラー', relation: '孫 / 考古学者', avatar: generateAvatar('フィル', '#2d5a3d', '#4a9eff') }
    ],
    organizations: [
      { name: 'ミスカトニック大学', role: '創設者', icon: '🏛️' }
    ],
    locations: [
      { name: 'ミスカトニック大学・考古学博物館', icon: '🏛️' },
      { name: 'アーカム墓地', icon: '⚰️' }
    ]
  },
  {
    id: 'yuki-tanaka',
    name: '田中 雪',
    nameEn: 'Yuki Tanaka',
    job: '民俗学者',
    affiliation: '東京大学',
    status: 'alive',
    important: false,
    avatar: generateAvatar('田中', '#5a2d3d', '#f472b6'),
    image: generatePortrait('田中', '#3a1a2a', '#e879a8'),
    birthdate: '1985/11/03',
    origin: '日本・京都府',
    age: 38,
    gender: '女性',
    nationality: '日本',
    language: '日本語、英語',
    pet: '三毛猫「ミャア」',
    san: '72 / 99',
    skills: '民俗学 70%、図書館利用 60%',
    notes: 'フィルと共同研究を行っている',
    bio: [
      '京都出身の民俗学者。地方の伝承や怪奇譚のフィールドワークを専門とする。',
      'フィル・ミラーと共同で日本各地の地下遺跡調査を行っており、学術的な面とオカルト的な面の両方に精通している。'
    ],
    episodes: [
      {
        icon: '👻',
        title: '山の神の伝承',
        desc: '京都府の山村で「山の神」の伝承を調査中、実際に不可解な現象に遭遇した。'
      }
    ],
    scenarios: [
      { title: '失われた都', date: '2023/08/15' },
      { title: '黒き潮騒', date: '2024/01/22' }
    ],
    relatedNpcs: [
      { name: 'フィル・ミラー', relation: '共同研究者 / 考古学者', avatar: generateAvatar('フィル', '#2d5a3d', '#4a9eff') }
    ],
    organizations: [
      { name: '東京大学', role: '助手', icon: '🏛️' }
    ],
    locations: [
      { name: '京都・地下遺跡', icon: '🗺️' },
      { name: '東京大学・民俗学研究室', icon: '🏠' }
    ]
  },
  {
    id: 'james-blackwood',
    name: 'ジェームズ・ブラックウッド',
    nameEn: 'James Blackwood',
    job: '私立探偵',
    affiliation: '独立',
    status: 'alive',
    important: false,
    avatar: generateAvatar('JB', '#2d3d5a', '#60a5fa'),
    image: generatePortrait('JB', '#1a2a3a', '#3b82f6'),
    birthdate: '1895/09/08',
    origin: 'アメリカ・ニューヨーク',
    age: 55,
    gender: '男性',
    nationality: 'アメリカ合衆国',
    language: '英語',
    pet: 'なし',
    san: '58 / 99',
    skills: '探索 75%、拳銃 60%、説得 55%',
    notes: 'アーカム在住',
    bio: [
      'ニューヨーク出身の私立探偵。第一次世界大戦の経験を経てアーカムに移住。',
      '表向きは普通の探偵だが、超常的な事件にも関わることが多い。口は悪いが根は良い人物。'
    ],
    episodes: [
      {
        icon: '🔍',
        title: '消えた教授',
        desc: 'ミスカトニック大学の教授が失踪した事件を受け、フィルと共に調査を行った。'
      }
    ],
    scenarios: [
      { title: '黄衣の招待状', date: '2024/05/12' }
    ],
    relatedNpcs: [
      { name: 'フィル・ミラー', relation: '協力者 / 考古学者', avatar: generateAvatar('フィル', '#2d5a3d', '#4a9eff') }
    ],
    organizations: [],
    locations: [
      { name: 'アーカム・ブラックウッド事務所', icon: '🏠' }
    ]
  },
  {
    id: 'elena-vance',
    name: 'エレナ・ヴァンス',
    nameEn: 'Elena Vance',
    job: '医師',
    affiliation: 'アーカム総合病院',
    status: 'missing',
    important: true,
    avatar: generateAvatar('EV', '#5a4d2d', '#fbbf24'),
    image: generatePortrait('EV', '#3a2a1a', '#d97706'),
    birthdate: '1900/04/18',
    origin: 'アメリカ・ボストン',
    age: 50,
    gender: '女性',
    nationality: 'アメリカ合衆国',
    language: '英語、フランス語',
    pet: 'なし',
    san: '—',
    skills: '医学 80%、応急手当 75%',
    notes: '行方不明（2024年6月）',
    bio: [
      'ボストン出身の外科医。アーカム総合病院の院長を務め、地域医療に貢献してきた。',
      '「黒き潮騒」事件の後、行方不明となった。最後に目撃されたのはミスカトニック大学付近。'
    ],
    episodes: [
      {
        icon: '🏥',
        title: '深夜の救急',
        desc: '原因不明の患者を次々と受け入れ、異常な症状のパターンを発見した。'
      },
      {
        icon: '❓',
        title: '失踪',
        desc: '病院の書類をまとめた後、誰にも告げずに姿を消した。フィルは最後の目撃者の一人。'
      }
    ],
    scenarios: [
      { title: '黒き潮騒', date: '2024/01/22' }
    ],
    relatedNpcs: [
      { name: 'フィル・ミラー', relation: '友人 / 考古学者', avatar: generateAvatar('フィル', '#2d5a3d', '#4a9eff') }
    ],
    organizations: [
      { name: 'アーカム総合病院', role: '院長', icon: '🏥' }
    ],
    locations: [
      { name: 'アーカム総合病院', icon: '🏥' },
      { name: 'ミスカトニック大学', icon: '🏛️' }
    ]
  },
  {
    id: 'old-man-jenkins',
    name: 'ジェンキンス老人',
    nameEn: 'Old Man Jenkins',
    job: '灯台守',
    affiliation: 'なし',
    status: 'alive',
    important: false,
    avatar: generateAvatar('ジェ', '#4d4d4d', '#9ca3af'),
    image: generatePortrait('ジェ', '#2a2a2a', '#6b7280'),
    birthdate: '1870/12/01',
    origin: 'アメリカ・インスマス',
    age: 80,
    gender: '男性',
    nationality: 'アメリカ合衆国',
    language: '英語',
    pet: 'なし',
    san: '40 / 99',
    skills: '航海 50%、聞き込み 45%',
    notes: 'インスマス灯台で30年以上勤務',
    bio: [
      'インスマス港の灯台を30年以上守り続けている老人。地元の漁師たちからは「あの人は何でも知っている」と恐れられている。',
      '過去のインスマスの暗い歴史を知る数少ない生存者の一人だが、それについて語ることは滅多にない。'
    ],
    episodes: [
      {
        icon: '🌊',
        title: '潮騒の夜',
        desc: '嵐の夜、灯台から不気味な光を目撃したと証言。公式記録には残っていない。'
      }
    ],
    scenarios: [
      { title: '黒き潮騒', date: '2024/01/22' }
    ],
    relatedNpcs: [],
    organizations: [],
    locations: [
      { name: 'インスマス灯台', icon: '🗼' },
      { name: 'インスマス港', icon: '⚓' }
    ]
  }
];

/* ---- Avatar / Portrait SVG Generator ---- */
function generateAvatar(text, bg, accent) {
  const initial = text.charAt(0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="8" fill="${bg}"/>
    <circle cx="40" cy="32" r="14" fill="${accent}" opacity="0.6"/>
    <ellipse cx="40" cy="68" rx="22" ry="16" fill="${accent}" opacity="0.4"/>
    <text x="40" y="36" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="600">${initial}</text>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function generatePortrait(text, bg, accent) {
  const initial = text.charAt(0);
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

/* ---- Status Labels ---- */
const STATUS_LABELS = {
  alive: '生存',
  dead: '死亡',
  missing: '行方不明'
};

const STATUS_CLASSES = {
  alive: 'status-alive',
  dead: 'status-dead',
  missing: 'status-missing'
};

/* ---- State ---- */
let currentNpcId = 'phil-miller';
let activeTab = 'summary';

/* ---- DOM Elements ---- */
const npcListEl = document.getElementById('npcList');
const npcDetailEl = document.getElementById('npcDetail');
const npcMetaEl = document.getElementById('npcMeta');
const npcSearchEl = document.getElementById('npcSearch');
const npcFilterEl = document.getElementById('npcFilter');
const npcCountEl = document.getElementById('npcCount');
const menuToggle = document.getElementById('menuToggle');
const sidebarClose = document.getElementById('sidebarClose');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

/* ---- Render Functions ---- */
function getFilteredNpcs() {
  const query = npcSearchEl.value.toLowerCase().trim();
  const filter = npcFilterEl.value;

  return NPC_DATA.filter(npc => {
    const matchQuery = !query ||
      npc.name.toLowerCase().includes(query) ||
      npc.nameEn.toLowerCase().includes(query) ||
      npc.job.toLowerCase().includes(query);

    let matchFilter = true;
    if (filter === 'alive') matchFilter = npc.status === 'alive';
    else if (filter === 'dead') matchFilter = npc.status === 'dead';
    else if (filter === 'missing') matchFilter = npc.status === 'missing';
    else if (filter === 'important') matchFilter = npc.important;

    return matchQuery && matchFilter;
  });
}

function renderNpcList() {
  const filtered = getFilteredNpcs();
  npcCountEl.innerHTML = `全 <strong>${filtered.length}</strong> 名`;

  npcListEl.innerHTML = filtered.map(npc => `
    <li class="npc-item ${npc.id === currentNpcId ? 'active' : ''}"
        role="option"
        aria-selected="${npc.id === currentNpcId}"
        data-id="${npc.id}">
      <img class="npc-avatar" src="${npc.avatar}" alt="${npc.name}">
      <div class="npc-item-info">
        <div class="npc-item-name">${npc.name}</div>
        <div class="npc-item-job">${npc.job}</div>
      </div>
      <span class="npc-item-status ${STATUS_CLASSES[npc.status]}">${STATUS_LABELS[npc.status]}</span>
    </li>
  `).join('');

  npcListEl.querySelectorAll('.npc-item').forEach(item => {
    item.addEventListener('click', () => {
      currentNpcId = item.dataset.id;
      activeTab = 'summary';
      renderNpcList();
      renderNpcDetail();
      renderNpcMeta();
    });
  });
}

function renderNpcDetail() {
  const npc = NPC_DATA.find(n => n.id === currentNpcId);
  if (!npc) return;

  const tags = [
    `<span class="tag tag-${npc.status === 'alive' ? 'alive' : npc.status === 'dead' ? 'dead' : 'missing'}">${STATUS_LABELS[npc.status]}</span>`
  ];
  if (npc.important) {
    tags.push('<span class="tag tag-important">重要NPC</span>');
  }

  npcDetailEl.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <img class="profile-image" src="${npc.image}" alt="${npc.name}">
        <div class="profile-info">
          <div class="profile-name-row">
            <h1 class="profile-name">${npc.name}</h1>
            <div class="profile-tags">${tags.join('')}</div>
            <div class="profile-actions">
              <button class="btn-edit">編集（KPのみ）</button>
              <button class="btn-more" aria-label="その他">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="profile-meta-grid">
            <div class="meta-item">
              <span class="meta-icon">📅</span>
              <span class="meta-label">生年月日</span>
              <span class="meta-value">${npc.birthdate}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">📍</span>
              <span class="meta-label">出身</span>
              <span class="meta-value">${npc.origin}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">💼</span>
              <span class="meta-label">職業</span>
              <span class="meta-value">${npc.job}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">🏛️</span>
              <span class="meta-label">所属</span>
              <span class="meta-value">${npc.affiliation}</span>
            </div>
            ${npc.pet !== 'なし' ? `
            <div class="meta-item">
              <span class="meta-icon">🐾</span>
              <span class="meta-label">ペット</span>
              <span class="meta-value">${npc.pet}</span>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <nav class="tab-nav" role="tablist">
      <button class="tab-btn ${activeTab === 'summary' ? 'active' : ''}" data-tab="summary" role="tab">概要</button>
      <button class="tab-btn ${activeTab === 'detail' ? 'active' : ''}" data-tab="detail" role="tab">詳細情報</button>
      <button class="tab-btn ${activeTab === 'episodes' ? 'active' : ''}" data-tab="episodes" role="tab">エピソード</button>
      <button class="tab-btn ${activeTab === 'related' ? 'active' : ''}" data-tab="related" role="tab">関連情報</button>
      <button class="tab-btn ${activeTab === 'memo' ? 'active' : ''}" data-tab="memo" role="tab">メモ（KPのみ）</button>
    </nav>

    <div class="tab-content ${activeTab === 'summary' ? 'active' : ''}" id="tab-summary" role="tabpanel">
      <section class="section-card">
        <h2 class="section-title"><span class="section-title-icon">📖</span>人物紹介</h2>
        <div class="bio-text">
          ${npc.bio.map(p => `<p>${p}</p>`).join('')}
        </div>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-title-icon">⚡</span>エピソード</h2>
        <div class="episode-list">
          ${npc.episodes.map(ep => `
            <div class="episode-item">
              <div class="episode-icon">${ep.icon}</div>
              <div class="episode-body">
                <h4>${ep.title}</h4>
                <p>${ep.desc}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="section-card">
        <h2 class="section-title"><span class="section-title-icon">📊</span>基本データ</h2>
        <div class="data-grid">
          <div class="data-group">
            <h4>プロフィール</h4>
            <dl>
              <div class="data-row"><dt>年齢</dt><dd>${npc.age}</dd></div>
              <div class="data-row"><dt>性別</dt><dd>${npc.gender}</dd></div>
              <div class="data-row"><dt>国籍</dt><dd>${npc.nationality}</dd></div>
              <div class="data-row"><dt>言語</dt><dd>${npc.language}</dd></div>
            </dl>
          </div>
          <div class="data-group">
            <h4>TRPGデータ</h4>
            <dl>
              <div class="data-row"><dt>SAN値</dt><dd>${npc.san}</dd></div>
              <div class="data-row"><dt>技能</dt><dd>${npc.skills}</dd></div>
              <div class="data-row"><dt>特記事項</dt><dd>${npc.notes}</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </div>

    <div class="tab-content ${activeTab === 'detail' ? 'active' : ''}" id="tab-detail" role="tabpanel">
      <section class="section-card">
        <h2 class="section-title"><span class="section-title-icon">📋</span>詳細情報</h2>
        <div class="data-grid">
          <div class="data-group">
            <h4>基本情報</h4>
            <dl>
              <div class="data-row"><dt>英語名</dt><dd>${npc.nameEn}</dd></div>
              <div class="data-row"><dt>生年月日</dt><dd>${npc.birthdate}</dd></div>
              <div class="data-row"><dt>出身地</dt><dd>${npc.origin}</dd></div>
              <div class="data-row"><dt>職業</dt><dd>${npc.job}</dd></div>
              <div class="data-row"><dt>所属</dt><dd>${npc.affiliation}</dd></div>
            </dl>
          </div>
          <div class="data-group">
            <h4>ゲーム情報</h4>
            <dl>
              <div class="data-row"><dt>状態</dt><dd>${STATUS_LABELS[npc.status]}</dd></div>
              <div class="data-row"><dt>重要NPC</dt><dd>${npc.important ? 'はい' : 'いいえ'}</dd></div>
              <div class="data-row"><dt>SAN値</dt><dd>${npc.san}</dd></div>
              <div class="data-row"><dt>技能</dt><dd>${npc.skills}</dd></div>
              <div class="data-row"><dt>特記事項</dt><dd>${npc.notes}</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </div>

    <div class="tab-content ${activeTab === 'episodes' ? 'active' : ''}" id="tab-episodes" role="tabpanel">
      <section class="section-card">
        <h2 class="section-title"><span class="section-title-icon">⚡</span>エピソード一覧</h2>
        <div class="episode-list">
          ${npc.episodes.map(ep => `
            <div class="episode-item">
              <div class="episode-icon">${ep.icon}</div>
              <div class="episode-body">
                <h4>${ep.title}</h4>
                <p>${ep.desc}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>

    <div class="tab-content ${activeTab === 'related' ? 'active' : ''}" id="tab-related" role="tabpanel">
      ${renderRelatedTabContent(npc)}
    </div>

    <div class="tab-content ${activeTab === 'memo' ? 'active' : ''}" id="tab-memo" role="tabpanel">
      <section class="section-card">
        <h2 class="section-title"><span class="section-title-icon">🔒</span>メモ（KPのみ）</h2>
        <div class="kp-memo-locked">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          KPモードでログインすると閲覧・編集が可能です
        </div>
      </section>
    </div>
  `;

  npcDetailEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderNpcDetail();
    });
  });
}

function renderRelatedTabContent(npc) {
  return `
    <section class="section-card">
      <h2 class="section-title"><span class="section-title-icon">📜</span>登場シナリオ</h2>
      <ul class="meta-list">
        ${npc.scenarios.map(s => `
          <li class="meta-list-item">
            <a href="#">${s.title}</a>
            <span class="meta-date">${s.date}</span>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </section>
    <section class="section-card">
      <h2 class="section-title"><span class="section-title-icon">👥</span>関連NPC</h2>
      <ul class="meta-list">
        ${npc.relatedNpcs.map(r => `
          <li class="meta-list-item">
            <div class="related-npc">
              <img class="related-avatar" src="${r.avatar}" alt="${r.name}">
              <div class="related-info">
                <div class="related-name">${r.name}</div>
                <div class="related-relation">${r.relation}</div>
              </div>
            </div>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </section>
    <section class="section-card">
      <h2 class="section-title"><span class="section-title-icon">🏛️</span>所属組織</h2>
      <ul class="meta-list">
        ${npc.organizations.map(o => `
          <li class="meta-list-item">
            <div class="org-item">
              <span class="org-icon">${o.icon}</span>
              <div>
                <div class="org-name">${o.name}</div>
                <div class="org-role">${o.role}</div>
              </div>
            </div>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </section>
    <section class="section-card">
      <h2 class="section-title"><span class="section-title-icon">🗺️</span>関連場所</h2>
      <ul class="meta-list">
        ${npc.locations.map(l => `
          <li class="meta-list-item">
            <div class="location-item">
              <span class="location-icon">${l.icon}</span>
              <span>${l.name}</span>
            </div>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </section>
  `;
}

function renderNpcMeta() {
  const npc = NPC_DATA.find(n => n.id === currentNpcId);
  if (!npc) return;

  npcMetaEl.innerHTML = `
    <div class="meta-card">
      <h3 class="meta-card-title">登場シナリオ</h3>
      <ul class="meta-list">
        ${npc.scenarios.map(s => `
          <li class="meta-list-item">
            <a href="#">${s.title}</a>
            <span class="meta-date">${s.date}</span>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </div>

    <div class="meta-card">
      <h3 class="meta-card-title">関連NPC</h3>
      <ul class="meta-list">
        ${npc.relatedNpcs.map(r => `
          <li class="meta-list-item">
            <div class="related-npc">
              <img class="related-avatar" src="${r.avatar}" alt="${r.name}">
              <div class="related-info">
                <div class="related-name">${r.name}</div>
                <div class="related-relation">${r.relation}</div>
              </div>
            </div>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </div>

    <div class="meta-card">
      <h3 class="meta-card-title">所属組織</h3>
      <ul class="meta-list">
        ${npc.organizations.map(o => `
          <li class="meta-list-item">
            <div class="org-item">
              <span class="org-icon">${o.icon}</span>
              <div>
                <div class="org-name">${o.name}</div>
                <div class="org-role">${o.role}</div>
              </div>
            </div>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </div>

    <div class="meta-card">
      <h3 class="meta-card-title">関連場所</h3>
      <ul class="meta-list">
        ${npc.locations.map(l => `
          <li class="meta-list-item">
            <div class="location-item">
              <span class="location-icon">${l.icon}</span>
              <span>${l.name}</span>
            </div>
          </li>
        `).join('') || '<li class="meta-list-item" style="color:var(--text-muted)">なし</li>'}
      </ul>
    </div>

    <div class="meta-card">
      <h3 class="meta-card-title">メモ（KPのみ）</h3>
      <div class="kp-memo-locked">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        KPモードで閲覧可能
      </div>
    </div>
  `;
}

/* ---- Mobile Menu ---- */
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

/* ---- Search & Filter ---- */
npcSearchEl.addEventListener('input', renderNpcList);
npcFilterEl.addEventListener('change', renderNpcList);

/* ---- Init ---- */
renderNpcList();
renderNpcDetail();
renderNpcMeta();
