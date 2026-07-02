/**
 * ミ＝ゴキャッチャー — Mi-go（ユゴスよりの菌類）の鉤爪で景品を掴む
 * 設計: docs/migo-catcher.md
 */
(function () {
  'use strict';

  const GAME_NAME = 'ミ＝ゴキャッチャー';
  const GAS_ENDPOINT = (window.AppConfig && window.AppConfig.api && window.AppConfig.api.baseUrl) || '';
  const MC = window.MigoCosmetics || {};
  const PRIZES = MC.PRIZES || [];
  const COSMETIC_LABELS = MC.LABELS || {};
  const BASE_COUNT = MC.BASE_COUNT || PRIZES.length;
  const COMP_ID = MC.COMP_ID || 'frame-migo-wing';

  const MIGO_PINK = '#e8575f';
  const MIGO_PINK_LIGHT = '#f47a82';
  const MIGO_PINK_DARK = '#b83d48';
  const MIGO_HEAD = '#3a3538';
  const MIGO_GLOW = 'rgba(232, 87, 95, 0.38)';

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
  const collectionProgress = document.getElementById('collectionProgress');
  const loadingScreen = document.getElementById('loadingScreen');

  const session = {
    playerName: '',
    pcId: '',
    playId: '',
    balance: 0,
    cosmetics: []
  };

  let allPcs = [];
  let balanceLoading = false;
  let animTime = 0;

  const state = {
    running: false,
    busy: false,
    played: false,
    craneX: W / 2,
    ropeY: 52,
    clawOpen: true,
    held: null,
    prizes: [],
    moveLeft: false,
    moveRight: false,
    shake: 0,
    particles: [],
    fadePrize: null,
    loopActive: false
  };

  const ROPE_MIN = 52;
  const ROPE_MAX = 336;
  const GRAB_Y_OFFSET = 34;
  const GRAB_DY = 32;
  const PRIZE_BASE_Y = 364;
  const DISPLAY_PRIZE_COUNT = 5;
  const PRIZE_DRIFT_AMPLITUDE = 6;
  const ARM_SPEED = 3.4;
  const DROP_SPEED = 2.6;
  const ALIGN_PX = 24;

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
      updateCoinDisplay(result.data.balance);
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

  function ownedBaseCount(cosmetics) {
    const set = new Set(cosmetics || []);
    return (MC.BASE_IDS || []).filter(id => set.has(id)).length;
  }

  function showPcCosmetics(pcId) {
    const pc = allPcs.find(p => p.id === pcId);
    const panel = document.getElementById('collectionPanel');
    const list = document.getElementById('collectionList');
    const cosmetics = (pc && pc.cosmetics) || session.cosmetics || [];
    const owned = ownedBaseCount(cosmetics);
    const hasComp = cosmetics.indexOf(COMP_ID) >= 0;

    if (!cosmetics.length) {
      panel.hidden = true;
      list.innerHTML = '';
      if (collectionProgress) collectionProgress.textContent = '';
      return;
    }

    panel.hidden = false;
    if (collectionProgress) {
      collectionProgress.textContent = hasComp
        ? `${BASE_COUNT}/${BASE_COUNT} コンプ！ ミ＝ゴの翼を獲得済み`
        : `コレクション ${owned}/${BASE_COUNT} — 全種でコンプボーナス`;
    }

    const allIds = [...new Set(cosmetics)];
    list.innerHTML = allIds.map(id => {
      const prize = PRIZES.find(p => p.cosmeticId === id);
      const meta = MC.META && MC.META[id];
      const emoji = prize ? prize.emoji : (meta ? meta.emoji : (id === COMP_ID ? '🦇' : '✨'));
      const label = COSMETIC_LABELS[id] || (meta && meta.label) || id;
      const ownedClass = (MC.BASE_IDS || []).indexOf(id) >= 0 || id === COMP_ID ? ' is-owned' : '';
      return `<li class="${ownedClass.trim()}" title="${escapeHtml(label)}">${emoji}</li>`;
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

  function pickRandomItems_(items, count) {
    const pool = items.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, Math.min(count, pool.length));
  }

  function visiblePrizesForPc(pcId) {
    const pc = allPcs.find(p => p.id === pcId);
    const ownedSet = new Set(((pc && pc.cosmetics) || session.cosmetics || []).filter(id => id !== COMP_ID));
    const unowned = PRIZES.filter(p => !ownedSet.has(p.cosmeticId));
    const owned = PRIZES.filter(p => ownedSet.has(p.cosmeticId));
    const picked = pickRandomItems_(unowned, DISPLAY_PRIZE_COUNT);
    if (picked.length < DISPLAY_PRIZE_COUNT) {
      const fill = pickRandomItems_(owned, DISPLAY_PRIZE_COUNT - picked.length);
      fill.forEach(item => picked.push(item));
    }
    return picked;
  }

  function prizeCurrentX(prize) {
    if (prize === state.held) return state.craneX;
    const phase = animTime * prize.driftSpeed + prize.driftPhase;
    const rawX = prize.baseX + Math.sin(phase) * prize.driftAmp;
    return Math.max(24, Math.min(W - 24, rawX));
  }

  function initPrizes(pcId) {
    const visible = visiblePrizesForPc(pcId);
    const count = Math.max(visible.length, 1);
    const startX = 28;
    const endX = W - 28;
    const gapX = count > 1 ? (endX - startX) / (count - 1) : 0;
    state.prizes = visible.map((prize, slot) => {
      const baseX = startX + slot * gapX;
      return {
        ...prize,
        baseX,
        y: PRIZE_BASE_Y + (slot % 2 === 0 ? 0 : 8),
        taken: false,
        bob: Math.random() * Math.PI * 2,
        driftAmp: PRIZE_DRIFT_AMPLITUDE * (0.7 + Math.random() * 0.6),
        driftSpeed: 1.1 + Math.random() * 0.8,
        driftPhase: Math.random() * Math.PI * 2
      };
    });
  }

  function prizeUnderClaw(x, ropeY) {
    const grabY = ropeY + GRAB_Y_OFFSET;
    let best = null;
    let bestScore = Infinity;
    state.prizes.forEach(p => {
      if (p.taken) return;
      const px = prizeCurrentX(p);
      const dx = Math.abs(px - x);
      if (dx > ALIGN_PX) return;
      const dy = Math.abs(p.y - grabY);
      if (dy > GRAB_DY) return;
      const score = dx + dy * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    });
    return best;
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (1.2 + Math.random() * 2.5),
        vy: Math.sin(angle) * (1.2 + Math.random() * 2.5) - 1,
        life: 28 + Math.floor(Math.random() * 16),
        color
      });
    }
  }

  function tickParticles() {
    state.particles = state.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= 1;
      return p.life > 0;
    });
  }

  function drawStarfield() {
    ctx.fillStyle = '#0e0c14';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) {
      const sx = (i * 97 + 13) % W;
      const sy = (i * 53 + 7) % 280;
      const twinkle = 0.06 + Math.sin(animTime * 2 + i) * 0.04;
      ctx.fillStyle = `rgba(255,255,255,${twinkle + (i % 5) * 0.03})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(232, 87, 95, 0.08)');
    grad.addColorStop(0.45, 'rgba(40, 20, 35, 0.2)');
    grad.addColorStop(1, 'rgba(8, 6, 12, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCabinet() {
    const pitTop = 278;
    ctx.fillStyle = '#151224';
    ctx.fillRect(8, pitTop, W - 16, H - pitTop - 8);
    ctx.strokeStyle = 'rgba(232, 87, 95, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, pitTop, W - 16, H - pitTop - 8);

    ctx.fillStyle = 'rgba(232, 87, 95, 0.14)';
    ctx.fillRect(12, pitTop + 4, W - 24, 10);

    const glassGrad = ctx.createLinearGradient(0, pitTop, 0, pitTop + 80);
    glassGrad.addColorStop(0, 'rgba(255, 220, 230, 0.12)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(12, pitTop + 4, W - 24, 80);

    ctx.textAlign = 'center';

  }

  function drawPrizes() {
    state.prizes.forEach(p => {
      if (p.taken && state.held !== p) return;
      const bob = Math.sin(animTime * 2.2 + p.bob) * 2;
      const px = prizeCurrentX(p);
      const py = (p === state.held ? state.ropeY + 36 : p.y) + bob;
      const size = 21;

      // Windows canvas emoji can look desaturated; keep a bright base tint.
      ctx.fillStyle = '#ffeef3';
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 185, 205, 0.7)';
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 1;
      ctx.fillText(p.emoji, px, py);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (!p.taken) {
        ctx.fillStyle = 'rgba(232, 87, 95, 0.2)';
        ctx.beginPath();
        ctx.ellipse(px, py + 11, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (state.fadePrize) {
      const fp = state.fadePrize;
      const size = 24;
      ctx.fillStyle = '#ffeef3';
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 185, 205, 0.7)';
      ctx.shadowBlur = 18 * fp.alpha;
      ctx.globalAlpha = fp.alpha;
      ctx.fillText(fp.emoji, fp.x, fp.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  async function animatePrizeFadeOut(emoji, x, y) {
    let alpha = 1;
    let fy = y;
    while (alpha > 0.02) {
      fy -= 2.8;
      alpha -= 0.035;
      state.fadePrize = { emoji, x, y: fy, alpha };
      drawMachine();
      await wait(16);
    }
    state.fadePrize = null;
  }

  function drawSegmentedArm(x, y) {
    const segments = 4;
    const segLen = y / segments;
    for (let i = 0; i < segments; i++) {
      const y0 = i * segLen;
      const y1 = (i + 1) * segLen;
      const wobble = Math.sin(animTime * 3 + i) * 1.5;
      ctx.strokeStyle = i % 2 === 0 ? MIGO_PINK : MIGO_PINK_LIGHT;
      ctx.lineWidth = 5 - i * 0.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + wobble, y0);
      ctx.lineTo(x - wobble * 0.5, y1);
      ctx.stroke();

      if (i < segments - 1) {
        ctx.fillStyle = MIGO_PINK_DARK;
        ctx.beginPath();
        ctx.ellipse(x, y1, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let s = 0; s < 3; s++) {
      const spotY = segLen * (0.4 + s * 0.55);
      ctx.fillStyle = 'rgba(184, 61, 72, 0.55)';
      ctx.beginPath();
      ctx.arc(x + (s % 2 ? 3 : -3), spotY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTentacleHead(x, y, scale) {
    const r = 11 * scale;
    ctx.fillStyle = MIGO_HEAD;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + animTime * 0.8;
      const len = 5 + Math.sin(animTime * 4 + i) * 1.5;
      ctx.strokeStyle = '#5a5558';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r * 0.7, y + Math.sin(ang) * r * 0.55);
      ctx.lineTo(x + Math.cos(ang) * (r + len), y + Math.sin(ang) * (r + len * 0.8));
      ctx.stroke();
    }
  }

  function drawMigoArm(x, y, open) {
    const pinch = open ? 1 : 0.45;
    drawSegmentedArm(x, y);

    const hubY = y + 6;
    drawTentacleHead(x, hubY - 10, open ? 0.75 : 0.95);

    ctx.fillStyle = MIGO_PINK_DARK;
    ctx.beginPath();
    ctx.ellipse(x, hubY, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = MIGO_PINK;
    ctx.lineWidth = 2;
    ctx.stroke();

    function drawClaw(side) {
      const dir = side === 'left' ? -1 : 1;
      const reach = (open ? 28 : 14) * pinch;
      const tipX = x + dir * reach;
      const tipY = hubY + 30;
      const midX = x + dir * (reach * 0.5);
      const midY = hubY + 16;
      const jointX = x + dir * (reach * 0.78);
      const jointY = hubY + 24;

      ctx.strokeStyle = MIGO_PINK;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + dir * 4, hubY + 2);
      ctx.quadraticCurveTo(midX, midY, jointX, jointY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.fillStyle = MIGO_PINK_LIGHT;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - dir * 8, tipY + 12);
      ctx.lineTo(tipX + dir * 3, tipY + 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = MIGO_PINK_DARK;
      ctx.beginPath();
      ctx.arc(jointX, jointY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawClaw('left');
    drawClaw('right');
  }

  function drawParticlesLayer() {
    state.particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawMachine() {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 0.6 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawStarfield();
    drawCabinet();
    drawPrizes();
    drawMigoArm(state.craneX, state.ropeY, state.clawOpen);
    drawParticlesLayer();

    if (state.running && !state.busy) {
      ctx.fillStyle = MIGO_GLOW;
      ctx.fillRect(state.craneX - 22, state.ropeY + 24, 44, 5);
      ctx.strokeStyle = 'rgba(232, 87, 95, 0.35)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(state.craneX, state.ropeY + 30);
      ctx.lineTo(state.craneX, PRIZE_BASE_Y - 18);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
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
      if (saveResult && saveResult.ok && saveResult.data && saveResult.data.comp_granted) {
        body += ' 🦇 全種コンプ！ミ＝ゴの翼が付与されました！';
      }
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

    const target = prizeUnderClaw(state.craneX, state.ropeY);
    state.clawOpen = false;
    state.shake = 4;
    drawMachine();
    await wait(280);
    state.shake = 0;

    const rate = target ? (target.grabRate || 0.7) : 0;
    const won = !!(target && Math.random() < rate);

    if (won) {
      state.held = target;
      target.taken = true;
      spawnParticles(state.craneX, state.ropeY + 36, MIGO_PINK_LIGHT);
    } else if (target) {
      state.shake = 6;
      await wait(120);
      state.shake = 0;
    }

    while (state.ropeY > ROPE_MIN) {
      state.ropeY -= DROP_SPEED * 0.92;
      drawMachine();
      await wait(16);
    }

    if (state.held) {
      const prize = state.held;
      state.held = null;
      state.clawOpen = true;
      const fadeX = state.craneX;
      const fadeY = state.ropeY + 36;
      spawnParticles(fadeX, fadeY, MIGO_PINK_LIGHT);
      await animatePrizeFadeOut(prize.emoji, fadeX, fadeY);
      state.played = true;
      const saveResult = await finishPlay(true, prize.cosmeticId);
      showResult(true, prize, saveResult);
    } else {
      state.clawOpen = true;
      drawMachine();
      await wait(140);
      state.played = true;
      const saveResult = await finishPlay(false);
      showResult(false, null, saveResult);
    }

    state.busy = false;
  }

  function gameLoop() {
    animTime += 0.016;
    tickParticles();
    if (state.shake > 0) state.shake *= 0.85;

    if (state.running && !state.busy) {
      if (state.moveLeft) state.craneX = Math.max(26, state.craneX - ARM_SPEED);
      if (state.moveRight) state.craneX = Math.min(W - 26, state.craneX + ARM_SPEED);
    } else if (!state.running) {
      state.craneX = W / 2 + Math.sin(animTime * 0.9) * 10;
      state.ropeY = ROPE_MIN + Math.sin(animTime * 1.4) * 4;
      state.clawOpen = true;
    }

    drawMachine();
    requestAnimationFrame(gameLoop);
  }

  function bindHold(btn, key, on) {
    const block = e => e.preventDefault();
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
    btn.addEventListener('touchstart', block, { passive: false });
    btn.addEventListener('touchmove', block, { passive: false });
    btn.addEventListener('contextmenu', block);
    btn.addEventListener('selectstart', block);
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
    state.particles = [];
    state.fadePrize = null;
    initPrizes(pcId);
    document.getElementById('btnDrop').disabled = false;
  }

  function returnToStart() {
    resultScreen.hidden = true;
    startScreen.hidden = false;
    gameControls.hidden = true;
    state.running = false;
    resultTitle.textContent = '結果';
    resultText.textContent = '';
    refreshBalance();
    validateForm();
  }

  document.getElementById('btnDrop').addEventListener('click', dropSequence);
  document.getElementById('btnDrop').addEventListener('touchstart', e => e.preventDefault(), { passive: false });
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
    if (loadingScreen) loadingScreen.hidden = false;
    initPrizes('');
    if (!state.loopActive) {
      state.loopActive = true;
      gameLoop();
    }
    allPcs = await loadPcs();
    updatePcSelect();
    await refreshBalance();
    if (!GAS_ENDPOINT) {
      setFormStatus('API未設定のためローカル表示のみです', 'warn');
    }
    if (loadingScreen) loadingScreen.hidden = true;
  }

  boot();

  if (typeof document !== 'undefined' && GAME_NAME) {
    document.title = `${GAME_NAME} — YOKOFOLIA`;
  }
})();
