/**
 * マリウスの露天商 — PL向けショップ画面
 * PL識別・コイン残高はミ＝ゴキャッチャーと同じ player_name + MIGO_COINS
 */
(function () {
  'use strict';

  const GAS_ENDPOINT = (window.AppConfig && window.AppConfig.api && window.AppConfig.api.baseUrl) || '';
  const PLAYER_KEY = 'migo_shop_player_name';

  const MARIUS_PATTERNS = [
    {
      image: '../images/marius-1.png',
      line: '僕も教授やみんなの役に立ちたい！',
      sub: 'スラムの角で屋台やってるよ。菌糸コインで見ていきな！'
    },
    {
      image: '../images/marius-2.png',
      line: 'おかえり〜！今日もいい品、並べといたよ。',
      sub: '在庫なくなったらすみません。次はもっと仕入れるね。'
    },
    {
      image: '../images/marius-3.png',
      line: 'へへっ、秘密の仕入れルートがあるんだ。',
      sub: '……誰にも言わないでね？教授には自慢しちゃったけど。'
    },
    {
      image: '../images/marius-1.png',
      line: '買ってくれたら、僕も少し誇らしいな。',
      sub: 'ゴミみたいな路地でも、役に立てるならそれでいいんだ。'
    },
    {
      image: '../images/marius-2.png',
      line: 'いらっしゃい！菌糸コイン、持ってる？',
      sub: '足りなくても大丈夫。見てるだけでも歓迎だよ。'
    },
    {
      image: '../images/marius-3.png',
      line: 'ん〜こっちの箱、なんか怪しく光ってる……',
      sub: 'でも効くから問題なし！たぶん！'
    }
  ];

  const playerNameInput = document.getElementById('playerName');
  const coinBalanceEl = document.getElementById('coinBalance');
  const formStatus = document.getElementById('formStatus');
  const refreshBtn = document.getElementById('refreshBtn');
  const productShelf = document.getElementById('productShelf');
  const shelfEmpty = document.getElementById('shelfEmpty');
  const productModal = document.getElementById('productModal');
  const productModalImage = document.getElementById('productModalImage');
  const productModalTitle = document.getElementById('productModalTitle');
  const productModalDesc = document.getElementById('productModalDesc');
  const productModalPrice = document.getElementById('productModalPrice');
  const productModalStock = document.getElementById('productModalStock');
  const productModalStatus = document.getElementById('productModalStatus');
  const buyBtn = document.getElementById('buyBtn');
  const shopkeeperImage = document.getElementById('shopkeeperImage');
  const speechLine = document.getElementById('speechLine');
  const speechSub = document.getElementById('speechSub');

  let products = [];
  let balance = null;
  let selectedId = null;
  let buying = false;
  let balanceName = '';
  let lastPatternIndex = -1;

  function pickMariusPattern() {
    if (!MARIUS_PATTERNS.length) return null;
    let index = Math.floor(Math.random() * MARIUS_PATTERNS.length);
    if (MARIUS_PATTERNS.length > 1 && index === lastPatternIndex) {
      index = (index + 1) % MARIUS_PATTERNS.length;
    }
    lastPatternIndex = index;
    return MARIUS_PATTERNS[index];
  }

  function applyMariusPattern(pattern) {
    if (!pattern) return;
    if (shopkeeperImage) {
      shopkeeperImage.classList.remove('is-swap');
      // reflow for fade
      void shopkeeperImage.offsetWidth;
      shopkeeperImage.src = pattern.image;
      shopkeeperImage.classList.add('is-swap');
    }
    if (speechLine) speechLine.textContent = pattern.line;
    if (speechSub) speechSub.textContent = pattern.sub;
  }

  function startMariusRotate() {
    applyMariusPattern(pickMariusPattern());
    const rotate = () => {
      applyMariusPattern(pickMariusPattern());
      const nextMs = 12000 + Math.floor(Math.random() * 10000);
      setTimeout(rotate, nextMs);
    };
    setTimeout(rotate, 14000 + Math.floor(Math.random() * 8000));
  }

  startMariusRotate();

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
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeName(name) {
    return String(name || '').trim();
  }

  function buildGasUrl(type, params) {
    if (!GAS_ENDPOINT) return '';
    const sep = GAS_ENDPOINT.includes('?') ? '&' : '?';
    const qs = new URLSearchParams({ type: type, ...(params || {}) }).toString();
    return `${GAS_ENDPOINT}${sep}${qs}`;
  }

  async function gasFetch(type, params) {
    if (!GAS_ENDPOINT) return { ok: false, offline: true };
    try {
      const res = await fetch(buildGasUrl(type, params), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.error) {
        if (data.error === 'unknown type') return { ok: false, needsDeploy: true, error: data.error };
        return { ok: false, error: data.error };
      }
      return { ok: true, data: data };
    } catch (err) {
      return { ok: false, error: err.message || 'fetch failed' };
    }
  }

  function setStatus(message, kind) {
    if (!message) {
      formStatus.hidden = true;
      formStatus.textContent = '';
      formStatus.className = 'ms-status';
      return;
    }
    formStatus.hidden = false;
    formStatus.textContent = message;
    formStatus.className = 'ms-status ms-status--' + (kind || 'info');
  }

  function setModalStatus(message, kind) {
    if (!message) {
      productModalStatus.hidden = true;
      productModalStatus.textContent = '';
      productModalStatus.className = 'ms-modal-status';
      return;
    }
    productModalStatus.hidden = false;
    productModalStatus.textContent = message;
    productModalStatus.className = 'ms-modal-status ms-modal-status--' + (kind || 'info');
  }

  function placeholderSvg(name) {
    const initial = (name || '?').charAt(0);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="12" fill="#2a1a18"/>
      <text x="80" y="92" text-anchor="middle" fill="#e8c4a8" font-size="48" font-family="sans-serif" font-weight="700">${initial}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function resolveProductImage(url, name) {
    const fallback = placeholderSvg(name);
    const attrs = (window.ImageUtils && window.ImageUtils.buildImgAttrs)
      ? window.ImageUtils.buildImgAttrs(url || '', fallback)
      : { src: url || fallback, fallbacks: [fallback] };
    const fallbacks = encodeURIComponent(JSON.stringify(attrs.fallbacks || []));
    return `<img class="ms-product-image" src="${escapeHtml(attrs.src)}" alt="${escapeHtml(name || '')}" loading="lazy" data-fallbacks="${fallbacks}" onerror="window.handleArchiveImgError&&window.handleArchiveImgError(this)">`;
  }

  function updateBalanceHud() {
    if (balance == null) {
      coinBalanceEl.textContent = '—';
      return;
    }
    coinBalanceEl.textContent = String(balance);
  }

  async function refreshBalance() {
    const name = normalizeName(playerNameInput.value);
    if (!name) {
      balance = null;
      balanceName = '';
      updateBalanceHud();
      setStatus('プレイヤー名を入力してください', 'error');
      return;
    }
    try {
      sessionStorage.setItem(PLAYER_KEY, name);
    } catch (e) { /* ignore */ }

    const result = await gasFetch('migo-balance', { player_name: name });
    if (result.needsDeploy) {
      setStatus('GASの再デプロイが必要です', 'error');
      return;
    }
    if (!result.ok) {
      setStatus(result.error || '残高を取得できませんでした', 'error');
      return;
    }
    balance = Number(result.data.balance) || 0;
    balanceName = name;
    updateBalanceHud();
    setStatus('残高を更新しました', 'ok');
  }

  function renderShelf() {
    const list = products.slice().sort((a, b) =>
      (a.sort_order || 0) - (b.sort_order || 0) ||
      String(a.name || '').localeCompare(String(b.name || ''), 'ja')
    );

    if (!list.length) {
      shelfEmpty.hidden = false;
      shelfEmpty.textContent = 'いまは並んでいる商品がありません';
      productShelf.querySelectorAll('.ms-product').forEach(el => el.remove());
      return;
    }

    shelfEmpty.hidden = true;
    productShelf.querySelectorAll('.ms-product').forEach(el => el.remove());

    list.forEach(product => {
      const soldOut = (product.stock || 0) < 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ms-product' + (soldOut ? ' is-soldout' : '');
      btn.setAttribute('role', 'listitem');
      btn.dataset.productId = product.product_id;
      btn.innerHTML = `
        <span class="ms-product-thumb">${resolveProductImage(product.image_url, product.name)}</span>
        <span class="ms-product-name">${escapeHtml(product.name)}</span>
        <span class="ms-product-price">${escapeHtml(String(product.price))} コイン</span>
        <span class="ms-product-stock">${soldOut ? '売切れ' : '在庫 ' + escapeHtml(String(product.stock))}</span>
      `;
      btn.addEventListener('click', () => openProduct(product.product_id));
      productShelf.appendChild(btn);
    });
  }

  async function loadCatalog() {
    const result = await gasFetch('migo-shop-catalog');
    if (result.needsDeploy) {
      shelfEmpty.hidden = false;
      shelfEmpty.textContent = 'ショップAPIが未デプロイです（migo-shop-catalog）';
      return;
    }
    if (!result.ok) {
      shelfEmpty.hidden = false;
      shelfEmpty.textContent = result.error || '商品を読み込めませんでした';
      return;
    }
    products = Array.isArray(result.data.products) ? result.data.products : [];
    renderShelf();
  }

  function getSelectedProduct() {
    return products.find(p => p.product_id === selectedId) || null;
  }

  function openProduct(productId) {
    const product = products.find(p => p.product_id === productId);
    if (!product) return;
    selectedId = productId;
    setModalStatus('', '');

    productModalTitle.textContent = product.name || '';
    productModalDesc.textContent = product.description || '（説明なし）';
    productModalPrice.textContent = String(product.price || 0);
    productModalStock.textContent = String(product.stock || 0);

    const fallback = placeholderSvg(product.name);
    const attrs = (window.ImageUtils && window.ImageUtils.buildImgAttrs)
      ? window.ImageUtils.buildImgAttrs(product.image_url || '', fallback)
      : { src: product.image_url || fallback, fallbacks: [fallback] };
    productModalImage.onerror = function () {
      if (window.handleArchiveImgError) window.handleArchiveImgError(productModalImage);
    };
    productModalImage.setAttribute('data-fallbacks', encodeURIComponent(JSON.stringify(attrs.fallbacks || [])));
    productModalImage.src = attrs.src;
    productModalImage.alt = product.name || '';

    const soldOut = (product.stock || 0) < 1;
    buyBtn.disabled = soldOut || buying;
    buyBtn.textContent = soldOut ? '在庫切れ' : '購入する（1個）';

    productModal.hidden = false;
    productModal.setAttribute('aria-hidden', 'false');
  }

  function closeProductModal() {
    productModal.hidden = true;
    productModal.setAttribute('aria-hidden', 'true');
    selectedId = null;
    setModalStatus('', '');
  }

  async function buySelected() {
    if (buying) return;
    const product = getSelectedProduct();
    if (!product) return;

    const name = normalizeName(playerNameInput.value);
    if (!name) {
      setModalStatus('プレイヤー名を入力してください', 'error');
      playerNameInput.focus();
      return;
    }
    if ((product.stock || 0) < 1) {
      setModalStatus('在庫切れです', 'error');
      return;
    }

    buying = true;
    buyBtn.disabled = true;
    setModalStatus('購入処理中…', 'info');

    const clientRequestId = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : ('req-' + Date.now() + '-' + Math.random().toString(16).slice(2));

    const result = await gasFetch('migo-shop-buy', {
      player_name: name,
      product_id: product.product_id,
      client_request_id: clientRequestId
    });

    buying = false;

    if (result.needsDeploy) {
      setModalStatus('GASの再デプロイが必要です（migo-shop-buy）', 'error');
      buyBtn.disabled = false;
      return;
    }
    if (!result.ok) {
      setModalStatus(result.error || '購入に失敗しました', 'error');
      buyBtn.disabled = (product.stock || 0) < 1;
      await loadCatalog();
      return;
    }

    balance = Number(result.data.balance);
    balanceName = name;
    updateBalanceHud();

    const idx = products.findIndex(p => p.product_id === product.product_id);
    if (idx >= 0 && result.data.stock != null) {
      products[idx].stock = Number(result.data.stock) || 0;
    }
    renderShelf();

    const updated = getSelectedProduct();
    if (updated) {
      productModalStock.textContent = String(updated.stock || 0);
      buyBtn.disabled = (updated.stock || 0) < 1;
      buyBtn.textContent = (updated.stock || 0) < 1 ? '在庫切れ' : '購入する（1個）';
    }

    setModalStatus(result.data.message || '購入しました', 'ok');
  }

  function bindUi() {
    refreshBtn.addEventListener('click', () => refreshBalance());
    playerNameInput.addEventListener('change', () => {
      const name = normalizeName(playerNameInput.value);
      try { sessionStorage.setItem(PLAYER_KEY, name); } catch (e) { /* ignore */ }
      if (name) refreshBalance();
    });
    buyBtn.addEventListener('click', () => buySelected());
    productModal.querySelectorAll('[data-ms-close]').forEach(el => {
      el.addEventListener('click', () => closeProductModal());
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !productModal.hidden) closeProductModal();
    });
  }

  async function boot() {
    bindUi();
    let saved = '';
    try { saved = sessionStorage.getItem(PLAYER_KEY) || ''; } catch (e) { saved = ''; }
    if (saved) {
      playerNameInput.value = saved;
      await refreshBalance();
    }
    await loadCatalog();
  }

  boot();
})();
