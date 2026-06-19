/**
 * チャウグナー・ラン — 横スクロールミニゲーム
 *
 * ルール:
 *  - 押すとジャンプ（地上）/ 浮遊（空中・燃料消費）
 *  - 離すと落下
 *  - 着地で燃料全回復。空中の燃料は約0.9秒分
 */
(function () {
  'use strict';

  const GAS_ENDPOINT = (window.AppConfig && window.AppConfig.api && window.AppConfig.api.baseUrl) || '';

  const MASCOT_IMAGE_PATH = '../images/yokofolia-mascot.png';
  const CANVAS_W = 800;
  const CANVAS_H = 320;
  const GROUND_Y = 260;
  const CEILING_Y = 88;
  const GRAVITY = 0.72;
  const JUMP_VELOCITY = -10;
  const FLOAT_VELOCITY = -2.6;
  const FLOAT_FUEL_MAX = 900;
  const BASE_SPEED = 4.6;
  const MAX_SPEED = 11;
  const NAME_MAX_LEN = 12;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const scoreHud = document.getElementById('scoreHud');
  const scoreValue = document.getElementById('scoreValue');
  const playerNameInput = document.getElementById('playerName');
  const startBtn = document.getElementById('startBtn');
  const retryBtn = document.getElementById('retryBtn');
  const startRankingEl = document.getElementById('startRanking');
  const overRankingEl = document.getElementById('overRanking');
  const resultNameEl = document.getElementById('resultName');
  const resultScoreEl = document.getElementById('resultScore');
  const saveStatusEl = document.getElementById('saveStatus');

  const mascotImg = new Image();
  let mascotLoaded = false;
  mascotImg.onload = () => { mascotLoaded = true; };
  mascotImg.onerror = () => { mascotLoaded = false; };
  mascotImg.src = MASCOT_IMAGE_PATH;

  let state = 'start';
  let playerName = '';
  let scoreMeters = 0;
  let gameSpeed = BASE_SPEED;
  let elapsedMs = 0;
  let animId = null;
  let lastTs = 0;
  let inputHeld = false;
  let nextSpawnIn = 0;

  const player = {
    x: 80,
    y: GROUND_Y,
    w: 44,
    h: 44,
    vy: 0,
    onGround: true,
    floatFuel: FLOAT_FUEL_MAX
  };

  let obstacles = [];

  const OBSTACLE_DEFS = {
    low: { type: 'low', w: 30, h: 38 },
    rock: { type: 'rock', w: 34, h: 28 },
    tall: { type: 'tall', w: 22, h: 50 },
    air: { type: 'air', w: 40, h: 28 }
  };

  const SPAWN_PATTERNS = [
  { id: 'low', weight: 40, spawn(obstacles, x) { addObstacle(obstacles, 'low', x); } },
  { id: 'rock', weight: 18, spawn(obstacles, x) { addObstacle(obstacles, 'rock', x); } },
  { id: 'tall', weight: 14, spawn(obstacles, x) { addObstacle(obstacles, 'tall', x); } },
  { id: 'air', weight: 12, minDiff: 0.15, spawn(obstacles, x) { addObstacle(obstacles, 'air', x); } },
  { id: 'low_air', weight: 10, minDiff: 0.2, spawn(obstacles, x) {
    addObstacle(obstacles, 'low', x);
    addObstacle(obstacles, 'air', x + 70 + Math.random() * 40);
  } },
  { id: 'double_low', weight: 6, minDiff: 0.35, spawn(obstacles, x) {
    addObstacle(obstacles, 'low', x);
    addObstacle(obstacles, Math.random() < 0.5 ? 'rock' : 'low', x + 50 + Math.random() * 30);
  } }
  ];

  function difficultyFactor() {
    return Math.min(1, elapsedMs / 75000);
  }

  function groundTop() {
    return GROUND_Y + player.h;
  }

  function addObstacle(list, kind, x) {
    const def = OBSTACLE_DEFS[kind];
    const floor = groundTop();
  let y;
    if (kind === 'air') {
      y = 128 + Math.floor(Math.random() * 24);
    } else {
      y = floor - def.h;
    }
    list.push({ x, y, w: def.w, h: def.h, type: def.type });
  }

  function pickSpawnPattern() {
    const t = difficultyFactor();
    const pool = SPAWN_PATTERNS.filter(p => (p.minDiff || 0) <= t);
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    for (const pattern of pool) {
      roll -= pattern.weight;
      if (roll <= 0) return pattern;
    }
    return pool[0];
  }

  function scheduleNextSpawn() {
    const t = difficultyFactor();
    const minGap = 220 - t * 45;
    const maxGap = 400 - t * 80;
    nextSpawnIn = minGap + Math.random() * (maxGap - minGap);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function formatMeters(m) {
    return `${Math.floor(m)} m`;
  }

  function buildGasUrl(type, params = {}) {
    if (!GAS_ENDPOINT) return '';
    const sep = GAS_ENDPOINT.includes('?') ? '&' : '?';
    const qs = new URLSearchParams({ type, ...params }).toString();
    return `${GAS_ENDPOINT}${sep}${qs}`;
  }

  async function loadRanking() {
    if (!GAS_ENDPOINT) {
      return { ok: true, data: [], offline: true };
    }
    try {
      const res = await fetch(buildGasUrl('chaugner-ranking'), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) {
        if (data.error === 'unknown type') return { ok: false, needsDeploy: true };
        throw new Error(data.error);
      }
      if (!Array.isArray(data)) throw new Error('invalid format');
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message || 'fetch failed' };
    }
  }

  async function saveScore(name, score) {
    if (!GAS_ENDPOINT) {
      return { ok: false, offline: true };
    }
    try {
      const res = await fetch(buildGasUrl('chaugner-score', {
        name: name.slice(0, NAME_MAX_LEN),
        score: String(Math.floor(score))
      }), {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) {
        if (data.error === 'unknown type') return { ok: false, needsDeploy: true };
        throw new Error(data.error);
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message || 'save failed' };
    }
  }

  function renderRankingList(el, result) {
    if (result.needsDeploy) {
      el.innerHTML = '<p class="cr-ranking-empty">ランキングはまだ有効化されていません（KP: GASの再デプロイが必要）</p>';
      return;
    }
    if (!result.ok) {
      el.innerHTML = '<p class="cr-ranking-error">ランキング取得に失敗しました</p>';
      return;
    }
    if (result.offline) {
      el.innerHTML = '<p class="cr-ranking-empty">ランキングは準備中です</p>';
      return;
    }
    if (!result.data.length) {
      el.innerHTML = '<p class="cr-ranking-empty">まだ記録がありません</p>';
      return;
    }
    const rows = result.data.slice(0, 3).map((row, i) => `
      <tr>
        <td class="cr-ranking-rank">${i + 1}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${formatMeters(row.score)}</td>
      </tr>
    `).join('');
    el.innerHTML = `
      <table class="cr-ranking-table">
        <thead>
          <tr><th>RANK</th><th>NAME</th><th>SCORE</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  async function refreshRankings() {
    const loading = '<p class="cr-ranking-loading">読み込み中…</p>';
    startRankingEl.innerHTML = loading;
    overRankingEl.innerHTML = loading;
    const result = await loadRanking();
    renderRankingList(startRankingEl, result);
    renderRankingList(overRankingEl, result);
    return result;
  }

  function resetGame() {
    scoreMeters = 0;
    gameSpeed = BASE_SPEED;
    elapsedMs = 0;
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.floatFuel = FLOAT_FUEL_MAX;
    obstacles = [];
    inputHeld = false;
    scheduleNextSpawn();
    updateScoreHud();
  }

  function updateScoreHud() {
    scoreValue.textContent = formatMeters(scoreMeters);
  }

  function pressStart() {
    if (state !== 'playing') return;
    inputHeld = true;
  }

  function pressEnd() {
    inputHeld = false;
  }

  function updatePlayer(dt) {
    if (player.onGround) {
      player.vy = 0;
      player.y = GROUND_Y;
      if (inputHeld) {
        player.onGround = false;
        player.vy = JUMP_VELOCITY;
      }
      return;
    }

    const canFloat = inputHeld && player.floatFuel > 0;
    if (canFloat) {
      player.floatFuel = Math.max(0, player.floatFuel - dt);
      player.vy = FLOAT_VELOCITY;
    } else {
      player.vy += GRAVITY;
    }

    player.y += player.vy;

    if (player.y < CEILING_Y) {
      player.y = CEILING_Y;
      if (player.vy < 0) player.vy = 0;
    }

    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
      player.floatFuel = FLOAT_FUEL_MAX;
    }
  }

  function drawMascot(x, y, w, h) {
    if (mascotLoaded) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(mascotImg, 0, 0, w, h);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#4a6a5a';
    ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
    ctx.fillStyle = '#6b9e7a';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.32, w * 0.38, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8487a';
    ctx.beginPath();
    ctx.arc(x + w * 0.62, y + h * 0.28, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawObstacle(obs) {
    if (obs.type === 'low') {
      ctx.fillStyle = '#5a3d4a';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#7a5560';
      ctx.fillRect(obs.x - 5, obs.y + 8, 7, 12);
    } else if (obs.type === 'tall') {
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#e8487a';
      ctx.fillRect(obs.x + 3, obs.y + 6, obs.w - 6, 5);
    } else if (obs.type === 'air') {
      ctx.fillStyle = '#6a4a5a';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = 'rgba(232, 72, 122, 0.4)';
      ctx.fillRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
    } else {
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFuelBar() {
    if (state !== 'playing') return;
    const ratio = player.floatFuel / FLOAT_FUEL_MAX;
    const barX = 16;
    const barY = 14;
    const barW = 100;
    const barH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = ratio > 0.25 ? '#e8487a' : '#c9a84c';
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('FUEL', barX, barY - 3);
  }

  function drawScene() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < CANVAS_W; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, CANVAS_H);
      ctx.stroke();
    }

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, groundTop(), CANVAS_W, CANVAS_H - groundTop());
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(0, groundTop());
    ctx.lineTo(CANVAS_W, groundTop());
    ctx.stroke();

    for (const obs of obstacles) {
      drawObstacle(obs);
    }

    drawMascot(player.x, player.y, player.w, player.h);

    if (!player.onGround && inputHeld && player.floatFuel > 0) {
      ctx.fillStyle = 'rgba(232, 72, 122, 0.18)';
      ctx.beginPath();
      ctx.ellipse(player.x + player.w / 2, player.y + player.h + 5, player.w * 0.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawFuelBar();
  }

  function rectsOverlap(a, b) {
    const pad = 5;
    return a.x + pad < b.x + b.w - pad &&
      a.x + a.w - pad > b.x + pad &&
      a.y + pad < b.y + b.h - pad &&
      a.y + a.h - pad > b.y + pad;
  }

  function update(dt) {
    elapsedMs += dt;
    const speedBoost = Math.min(MAX_SPEED - BASE_SPEED, elapsedMs / 14000);
    gameSpeed = BASE_SPEED + speedBoost;

    scoreMeters += (gameSpeed * dt) / 60;
    updateScoreHud();
    updatePlayer(dt);

    for (const obs of obstacles) {
      obs.x -= gameSpeed;
    }
    obstacles = obstacles.filter(o => o.x + o.w > -30);

    nextSpawnIn -= gameSpeed;
    if (nextSpawnIn <= 0) {
      const pattern = pickSpawnPattern();
      pattern.spawn(obstacles, CANVAS_W + 20 + Math.random() * 50);
      scheduleNextSpawn();
    }

    const playerBox = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (const obs of obstacles) {
      if (rectsOverlap(playerBox, obs)) {
        endGame();
        return;
      }
    }
  }

  function gameLoop(ts) {
    if (state !== 'playing') return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(ts - lastTs, 32);
    lastTs = ts;
    update(dt);
    drawScene();
    animId = requestAnimationFrame(gameLoop);
  }

  function startGame() {
    const name = playerNameInput.value.trim().slice(0, NAME_MAX_LEN);
    if (!name) return;
    playerName = name;
    resetGame();
    state = 'playing';
    startScreen.hidden = true;
    gameOverScreen.hidden = true;
    scoreHud.hidden = false;
    lastTs = 0;
    drawScene();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(gameLoop);
  }

  async function endGame() {
    state = 'gameover';
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    drawScene();

    resultNameEl.textContent = playerName;
    resultScoreEl.textContent = formatMeters(scoreMeters);
    saveStatusEl.textContent = 'スコアを登録しています…';
    saveStatusEl.className = 'cr-save-status';

    gameOverScreen.hidden = false;
    scoreHud.hidden = true;

    const saveResult = await saveScore(playerName, scoreMeters);
    if (saveResult.ok) {
      saveStatusEl.textContent = 'ランキングに登録しました';
      saveStatusEl.className = 'cr-save-status cr-save-status--ok';
    } else if (saveResult.needsDeploy) {
      saveStatusEl.textContent = 'スコアは保存されませんでした（KP: GASの再デプロイが必要）';
      saveStatusEl.className = 'cr-save-status cr-save-status--warn';
    } else if (saveResult.offline) {
      saveStatusEl.textContent = 'スコアは記録されませんでした（ランキング準備中）';
      saveStatusEl.className = 'cr-save-status cr-save-status--warn';
    } else {
      saveStatusEl.textContent = 'スコアの保存に失敗しました（ゲームは正常終了）';
      saveStatusEl.className = 'cr-save-status cr-save-status--warn';
    }

    await refreshRankings();
  }

  function showStartScreen() {
    state = 'start';
    startScreen.hidden = false;
    gameOverScreen.hidden = true;
    scoreHud.hidden = true;
    if (playerName) playerNameInput.value = playerName;
    validateNameInput();
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    drawScene();
  }

  function validateNameInput() {
    startBtn.disabled = !playerNameInput.value.trim();
  }

  playerNameInput.addEventListener('input', validateNameInput);
  playerNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !startBtn.disabled) startGame();
  });
  startBtn.addEventListener('click', startGame);
  retryBtn.addEventListener('click', showStartScreen);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      pressStart();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      pressEnd();
    }
  });

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    pressStart();
  });

  canvas.addEventListener('pointerup', e => {
    e.preventDefault();
    pressEnd();
  });

  canvas.addEventListener('pointercancel', pressEnd);

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    canvas.style.width = w + 'px';
    canvas.style.height = (w * CANVAS_H / CANVAS_W) + 'px';
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  drawScene();
  validateNameInput();
  refreshRankings();
})();
