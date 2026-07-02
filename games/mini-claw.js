/**
 * ミ＝ゴキャッチャー — Mi-go（ユゴスよりの菌類）の鉤爪で景品を掴む
 * 設計: docs/migo-catcher.md
 */
(function () {
  'use strict';

  const GAME_NAME = 'ミ＝ゴキャッチャー';
  const GAS_ENDPOINT = (window.AppConfig && window.AppConfig.api && window.AppConfig.api.baseUrl) || '';

  const MIGO_SHELL = '#d4a8b0';
  const MIGO_SHELL_DARK = '#9a7080';
  const MIGO_GLOW = 'rgba(212, 168, 176, 0.35)';

  const COSMETIC_LABELS = {
    'frame-fungal': 'ユゴス菌糸',
    'bg-nebula': '隕石片',
    'title-whisper': '禁断フィルム',
    'frame-bone': '地球製骨片',
    'fx-glimpse': '第三の眼',
    'bg-void': '暗黒の欠片',
    'frame-ether': 'エーテル結晶',
    'title-migo': '鉤爪の欠片',
    'frame-migo-wing': 'ミ＝ゴの翼'
  };

  const PRIZES = [
    { emoji: '🍄', label: 'ユゴス菌糸', cosmeticId: 'frame-fungal', grabRate: 0.78 },
    { emoji: '☄️', label: '隕石片', cosmeticId: 'bg-nebula', grabRate: 0.76 },
    { emoji: '📼', label: '禁断フィルム', cosmeticId: 'title-whisper', grabRate: 0.74 },
    { emoji: '🦴', label: '地球製骨片', cosmeticId: 'frame-bone', grabRate: 0.74 },
    { emoji: '👁', label: '第三の眼', cosmeticId: 'fx-glimpse', grabRate: 0.62 },
    { emoji: '🌑', label: '暗黒の欠片', cosmeticId: 'bg-void', grabRate: 0.62 },
    { emoji: '🛸', label: 'エーテル結晶', cosmeticId: 'frame-ether', grabRate: 0.58 },
    { emoji: '🔗', label: '鉤爪の欠片', cosmeticId: 'title-migo', grabRate: 0.58 }
  ];

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const startScreen = document.getElementById('startScreen');
  const resultScreen = document.getElementById('resultScreen');
  const gameControls = document.getElementById('gameControls');
  const startForm = document.getElementById('startForm');
  const playerNameInput = document.getElementById('playerName');
  const pcSelect = document.getElementById('pcSelect');
  const giftCodeInput = document.getElementById('giftCode');
  const redeemBtn = document.getElementById('redeemBtn');
  const startBtn = document.getElementById('startBtn');
  const formStatus = document.getElementById('formStatus');
  const coinBalanceEl = document.getElementById('coinBalance');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');
  const resultBtn = document.getElementById('resultBtn');

  const session = {
    playerName: '',
    pcId: '',
    playId: '',
    balance: 0,
    cosmetics: []
  };

  let allPcs = [];
  let balanceLoading = false;

  const state = {
    running: false,
    busy: false,
    played: false,
    craneX: W / 2,
    ropeY: 48,
    clawOpen: true,
    held: null,
    prizes: [],
    moveLeft: false,
    moveRight: false,
    headHue: 0.55
  };

  const ROPE_MIN = 48;
  const ROPE_MAX = 300;
  const ARM_SPEED = 3.2;
  const DROP_SPEED = 2.4;
  const ALIGN_PX = 26;

  function buildGasUrl(type, params = {}) {
    if (!GAS_ENDPOINT) return '';
    const sep = GAS_ENDPOINT.includes('?') ? '&' : '?';
    const qs = new URLSearchParams({ type, ...params }).toString();
    return `${GAS_ENDPOINT}${sep}${qs}`;
  }

  async function gasFetch(type, params = {}) {
    if (!GAS_ENDPOINT) return { ok: false, offline: true };
    try {
      const res = await fetch(buildGasUrl(type, params), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) {
        if (data.error === 'unknown type') return { ok: false, needsDeploy: true };
        return { ok: false, error: data.error };
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message || 'fetch failed' };
    }
  }

  async function loadPcs() {
    if (!GAS_ENDPOINT) return [];
    const result = await gasFetch('pcs');
    if (!result.ok || !Array.isArray(result.data)) return [];
    return result.data;
  }

  function normalizeName(name) {
    return String(name || '').trim();
  }

  function pcsForPlayer(name) {
    const player = normalizeName(name);
    if (!player) return [];
    return allPcs.filter(pc => normalizeName(pc.player_name || pc.playerName) === player);
  }

  function updatePcSelect() {
    const player = normalizeName(playerNameInput.value);
    const owned = pcsForPlayer(player);
    pcSelect.innerHTML = '';

    if (!player) {
      pcSelect.disabled = true;
      pcSelect.innerHTML = '<option value="">プレイヤー名を入力してください</option>';
      return;
    }

    if (!owned.length) {
      pcSelect.disabled = true;
      pcSelect.innerHTML = '<option value="">登録PCが見つかりません</option>';
      return;
    }

    pcSelect.disabled = false;
    owned.forEach(pc => {
      const opt = document.createElement('option');
      opt.value = pc.id;
      opt.textContent = pc.name || pc.id;
      pcSelect.appendChild(opt);
    });
  }

  function setFormStatus(message, kind) {
    if (!message) {
      formStatus.hidden = true;
      formStatus.textContent = '';
      formStatus.className = 'mc-status';
      return;
    }
    formStatus.hidden = false;
    formStatus.textContent = message;
    formStatus.className = `mc-status mc-status--${kind || 'info'}`;
  }

  function updateCoinDisplay(balance) {
    if (balance === null || balance === undefined || balance === '') {
      coinBalanceEl.textContent = GAS_ENDPOINT ? '…' : '—';
      return;
    }
    coinBalanceEl.textContent = String(balance);
    session.balance = balance;
  }

  async function refreshBalance() {
    const name = normalizeName(playerNameInput.value);
    if (!name || !GAS_ENDPOINT) {
      updateCoinDisplay(GAS_ENDPOINT ? 0 : '—');
      validateForm();
      return;
    }
    balanceLoading = true;
    validateForm();
    const result = await gasFetch('migo-balance', { player_name: name });
    balanceLoading = false;
    if (result.needsDeploy) {
      setFormStatus('GASの再デプロイが必要です（KP向け）', 'warn');
      updateCoinDisplay('—');
    } else if (!result.ok) {
      updateCoinDisplay(0);
    } else {
      updateCoinDisplay(result.data.balance || 0);
    }
    validateForm();
  }

  function validateForm() {
    const name = normalizeName(playerNameInput.value);
    const pcId = pcSelect.value;
    const hasPc = !!pcId && pcsForPlayer(name).length > 0;
    const canPlay = !!name && hasPc && session.balance >= 1 && !balanceLoading;
    startBtn.disabled = !canPlay;
    redeemBtn.disabled = !name || balanceLoading;
  }

  function showPcCosmetics(pcId) {
    const pc = allPcs.find(p => p.id === pcId);
    const panel = document.getElementById('collectionPanel');
    const list = document.getElementById('collectionList');
    const cosmetics = (pc && pc.cosmetics) || session.cosmetics || [];
    if (!cosmetics.length) {
      panel.hidden = true;
      list.innerHTML = '';
      return;
    }
    panel.hidden = false;
    list.innerHTML = cosmetics.map(id => {
      const prize = PRIZES.find(p => p.cosmeticId === id);
      const emoji = prize ? prize.emoji : (id === 'frame-migo-wing' ? '🦇' : '✨');
      const label = COSMETIC_LABELS[id] || id;
      return `<li title="${escapeHtml(label)}">${emoji}</li>`;
    }).join('');
  }

  async function handleRedeem() {
    const name = normalizeName(playerNameInput.value);
    const code = normalizeName(giftCodeInput.value).toUpperCase();
    if (!name) {
      setFormStatus('プレイヤー名を入力してください', 'warn');
      return;
    }
    if (!code) {
      setFormStatus('ギフトコードを入力してください', 'warn');
      return;
    }
    redeemBtn.disabled = true;
    setFormStatus('換金しています…', 'info');
    const result = await gasFetch('migo-redeem', { player_name: name, code });
    redeemBtn.disabled = false;
    if (result.needsDeploy) {
      setFormStatus('GASの再デプロイが必要です', 'warn');
      return;
    }
    if (!result.ok) {
      setFormStatus(result.error || '換金に失敗しました', 'error');
      return;
    }
    giftCodeInput.value = '';
    updateCoinDisplay(result.data.balance);
    setFormStatus(`+${result.data.coins_added} コイン獲得！`, 'ok');
    validateForm();
  }


  function initPrizes() {
    const cols = 4;
    const startX = 42;
    const startY = 318;
    const gapX = 72;
    const gapY = 48;
    state.prizes = PRIZES.map((p, i) => ({
      ...p,
      x: startX + (i % cols) * gapX,
      y: startY + Math.floor(i / cols) * gapY,
      taken: false
    }));
  }

  function nearestPrize(x) {
    let best = null;
    let bestDist = Infinity;
    state.prizes.forEach(p => {
      if (p.taken) return;
      const d = Math.abs(p.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    });
    return best;
  }

  function drawStarfield() {
    ctx.fillStyle = '#121018';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 + 13) % W;
      const sy = (i * 53 + 7) % 260;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 5) * 0.04})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(80, 40, 60, 0.15)');
    grad.addColorStop(1, 'rgba(10, 8, 16, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCabinet() {
    ctx.fillStyle = '#0e0c14';
    ctx.fillRect(10, 268, W - 20, H - 278);
    ctx.strokeStyle = 'rgba(212, 168, 176, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 268, W - 20, H - 278);

    ctx.fillStyle = 'rgba(212, 168, 176, 0.08)';
    ctx.fillRect(14, 272, W - 28, 8);

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(W - 52, 280, 38, H - 292);
    ctx.strokeStyle = MIGO_SHELL_DARK;
    ctx.strokeRect(W - 52, 280, 38, H - 292);
    ctx.fillStyle = MIGO_SHELL;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('菌糸', W - 33, 296);
    ctx.fillText('OUT', W - 33, 308);
  }

  function drawPrizes() {
    state.prizes.forEach(p => {
      if (p.taken && state.held !== p) return;
      const px = p === state.held ? state.craneX : p.x;
      const py = p === state.held ? state.ropeY + 38 : p.y;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, px, py);
    });
  }

  function drawMigoArm(x, y, open) {
    const pinch = open ? 1 : 0.5;

    ctx.strokeStyle = MIGO_SHELL_DARK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(180, 120, 140, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const hubY = y + 4;
    ctx.fillStyle = MIGO_SHELL_DARK;
    ctx.beginPath();
    ctx.ellipse(x, hubY, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    function drawClaw(side) {
      const dir = side === 'left' ? -1 : 1;
      const reach = (open ? 26 : 16) * pinch;
      const tipX = x + dir * reach;
      const tipY = hubY + 28;
      const midX = x + dir * (reach * 0.55);
      const midY = hubY + 14;

      ctx.strokeStyle = MIGO_SHELL;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, hubY + 4);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      ctx.fillStyle = MIGO_SHELL;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - dir * 6, tipY + 10);
      ctx.lineTo(tipX + dir * 2, tipY + 6);
      ctx.closePath();
      ctx.fill();
    }

    drawClaw('left');
    drawClaw('right');

    if (!open) {
      const headX = x;
      const headY = hubY - 6;
      ctx.fillStyle = `hsla(${state.headHue * 360}, 45%, 72%, 0.85)`;
      ctx.beginPath();
      ctx.ellipse(headX, headY, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = MIGO_SHELL_DARK;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#2a2030';
      ctx.beginPath();
      ctx.ellipse(headX - 4, headY - 1, 2, 3, -0.3, 0, Math.PI * 2);
      ctx.ellipse(headX + 4, headY - 1, 2, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMachine() {
    drawStarfield();
    drawCabinet();
    drawPrizes();
    drawMigoArm(state.craneX, state.ropeY, state.clawOpen);

    if (state.running && !state.busy) {
      ctx.fillStyle = MIGO_GLOW;
      ctx.fillRect(state.craneX - 20, state.ropeY + 20, 40, 4);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function finishPlay(won, cosmeticId) {
    const result = await gasFetch('migo-play-end', {
      player_name: session.playerName,
      play_id: session.playId,
      won: won ? '1' : '0',
      cosmetic_id: cosmeticId || ''
    });
    if (result.ok && result.data.cosmetics) {
      session.cosmetics = result.data.cosmetics;
      const pc = allPcs.find(p => p.id === session.pcId);
      if (pc) pc.cosmetics = result.data.cosmetics;
    }
    if (result.ok && result.data.balance !== undefined) {
      updateCoinDisplay(result.data.balance);
    }
    return result;
  }

  function showResult(won, prize, saveResult) {
    state.running = false;
    startScreen.hidden = true;
    gameControls.hidden = true;
    resultScreen.hidden = false;

    let body = '';
    if (won && prize) {
      resultTitle.textContent = '菌糸GET！';
      body = `${prize.emoji} ${prize.label} を ${session.playerName} のPCに装備しました。台帳で確認しよう。`;
    } else {
      resultTitle.textContent = '空振り…';
      body = 'ミ＝ゴの鉤爪は何も掴めなかった。コインは消費済みです。';
    }

    if (saveResult && saveResult.needsDeploy) {
      body += '（保存は未反映。KP: GASの再デプロイが必要）';
    } else if (saveResult && !saveResult.ok) {
      body += `（台帳への反映に失敗: ${saveResult.error || '通信エラー'}）`;
    }

    resultText.textContent = body;
    showPcCosmetics(session.pcId);
  }

  async function dropSequence() {
    if (!state.running || state.busy || state.played) return;
    state.busy = true;
    document.getElementById('btnDrop').disabled = true;

    while (state.ropeY < ROPE_MAX) {
      state.ropeY += DROP_SPEED;
      drawMachine();
      await wait(16);
    }

    const target = nearestPrize(state.craneX);
    const aligned = target && Math.abs(target.x - state.craneX) < ALIGN_PX;
    state.clawOpen = false;
    state.headHue = 0.85;
    drawMachine();
    await wait(300);

    const rate = target ? (target.grabRate || 0.7) : 0;
    const won = !!(target && aligned && Math.random() < rate);

    if (won) {
      state.held = target;
      target.taken = true;
    }

    while (state.ropeY > ROPE_MIN) {
      state.ropeY -= DROP_SPEED * 0.9;
      drawMachine();
      await wait(16);
    }

    if (state.held) {
      const destX = W - 33;
      while (Math.abs(state.craneX - destX) > 2) {
        state.craneX += Math.sign(destX - state.craneX) * ARM_SPEED;
        drawMachine();
        await wait(16);
      }
      state.craneX = destX;
      state.clawOpen = true;
      state.headHue = 0.55;
      const prize = state.held;
      state.held = null;
      drawMachine();
      await wait(220);
      while (state.craneX > W / 2) {
        state.craneX -= ARM_SPEED;
        drawMachine();
        await wait(16);
      }
      state.played = true;
      const saveResult = await finishPlay(true, prize.cosmeticId);
      showResult(true, prize, saveResult);
    } else {
      state.clawOpen = true;
      state.headHue = 0.35;
      drawMachine();
      await wait(120);
      state.headHue = 0.55;
      state.played = true;
      const saveResult = await finishPlay(false);
      showResult(false, null, saveResult);
    }

    state.busy = false;
  }

  function gameLoop() {
    if (!state.running) return;
    if (!state.busy) {
      if (state.moveLeft) state.craneX = Math.max(28, state.craneX - ARM_SPEED);
      if (state.moveRight) state.craneX = Math.min(W - 28, state.craneX + ARM_SPEED);
    }
    drawMachine();
    requestAnimationFrame(gameLoop);
  }

  function bindHold(btn, key, on) {
    const start = e => {
      e.preventDefault();
      state[key] = on;
      btn.classList.add('is-active');
    };
    const end = e => {
      e.preventDefault();
      state[key] = false;
      btn.classList.remove('is-active');
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('pointercancel', end);
  }

  async function startGameSession(e) {
    e.preventDefault();
    const name = normalizeName(playerNameInput.value);
    const pcId = pcSelect.value;
    if (!name || !pcId) return;

    startBtn.disabled = true;
    setFormStatus('コインを消費して筐体を起動中…', 'info');

    const result = await gasFetch('migo-play', { player_name: name, pc_id: pcId });
    if (result.needsDeploy) {
      setFormStatus('GASの再デプロイが必要です', 'warn');
      startBtn.disabled = false;
      return;
    }
    if (!result.ok) {
      setFormStatus(result.error || 'プレイを開始できませんでした', 'error');
      startBtn.disabled = false;
      validateForm();
      return;
    }

    session.playerName = name;
    session.pcId = pcId;
    session.playId = result.data.play_id;
    updateCoinDisplay(result.data.balance);
    setFormStatus('', '');

    startScreen.hidden = true;
    resultScreen.hidden = true;
    gameControls.hidden = false;

    state.running = true;
    state.busy = false;
    state.played = false;
    state.craneX = W / 2;
    state.ropeY = ROPE_MIN;
    state.clawOpen = true;
    state.held = null;
    state.headHue = 0.55;
    initPrizes();
    document.getElementById('btnDrop').disabled = false;
    gameLoop();
  }

  function returnToStart() {
    resultScreen.hidden = true;
    startScreen.hidden = false;
    gameControls.hidden = true;
    state.running = false;
    resultTitle.textContent = '結果';
    resultText.textContent = '';
    drawMachine();
    refreshBalance();
    validateForm();
  }

  document.getElementById('btnDrop').addEventListener('click', dropSequence);
  bindHold(document.getElementById('btnLeft'), 'moveLeft', true);
  bindHold(document.getElementById('btnRight'), 'moveRight', true);
  startForm.addEventListener('submit', startGameSession);
  redeemBtn.addEventListener('click', handleRedeem);
  resultBtn.addEventListener('click', returnToStart);

  playerNameInput.addEventListener('input', () => {
    updatePcSelect();
    refreshBalance();
    showPcCosmetics(pcSelect.value);
  });

  pcSelect.addEventListener('change', () => {
    showPcCosmetics(pcSelect.value);
    validateForm();
  });

  document.addEventListener('keydown', e => {
    if (!state.running || state.busy || state.played) return;
    if (e.key === 'ArrowLeft') state.moveLeft = true;
    if (e.key === 'ArrowRight') state.moveRight = true;
    if (e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      dropSequence();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft') state.moveLeft = false;
    if (e.key === 'ArrowRight') state.moveRight = false;
  });

  async function boot() {
    initPrizes();
    drawMachine();
    allPcs = await loadPcs();
    updatePcSelect();
    await refreshBalance();
    if (!GAS_ENDPOINT) {
      setFormStatus('API未設定のためローカル表示のみです', 'warn');
    }
  }

  boot();

  if (typeof document !== 'undefined' && GAME_NAME) {
    document.title = `${GAME_NAME} — YOKOFOLIA`;
  }
})();
