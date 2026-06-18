/**
 * KP入力ページ — フォームリンク集
 */
(function () {
  const FORM_CARDS = [
    {
      linkKey: 'npcForm',
      icon: '🧑‍🤝‍🧑',
      name: 'NPC登録フォーム',
      description: 'NPCの名前、画像、人物紹介、エピソード、関連情報を登録するフォーム。'
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function renderCards() {
    const grid = document.getElementById('kpCardGrid');
    const links = window.AppLinks || {};

    grid.innerHTML = FORM_CARDS.map(card => {
      const url = links[card.linkKey] || '#';
      const isReady = url && url !== '#';
      const target = isReady ? '_blank' : '';
      const rel = isReady ? 'noopener noreferrer' : '';
      const btnClass = isReady ? 'kp-card-btn' : 'kp-card-btn kp-card-btn--disabled';
      const btnLabel = isReady ? '開く' : '準備中';
      const ariaDisabled = isReady ? '' : ' aria-disabled="true" tabindex="-1"';

      return `
        <article class="kp-card">
          <span class="kp-card-icon">${card.icon}</span>
          <h2 class="kp-card-name">${escapeHtml(card.name)}</h2>
          <p class="kp-card-desc">${escapeHtml(card.description)}</p>
          <a href="${escapeHtml(url)}" class="${btnClass}"${isReady ? ` target="${target}" rel="${rel}"` : ariaDisabled}>
            ${btnLabel}
            ${isReady ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>' : ''}
          </a>
        </article>
      `;
    }).join('');
  }

  renderCards();
})();
