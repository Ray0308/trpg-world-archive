/**
 * チャウグナー・ラン — 横スクロールミニゲーム
 * GAS 連携: GAS_ENDPOINT を設定するとランキング保存・取得が有効
 */
(function () {
  'use strict';

  /** Google Apps Script Webアプリ URL（未設定ならランキングのみローカル無効） */
  const GAS_ENDPOINT = '';
  // 既存 API と同じデプロイを使う場合の例:
  // const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw20JiLGzzdC2m7uOgP14RecbtwFhbHUBuO-emsrDThF-YRsB8Ux60SQPOlRU5yXquw/exec';

  const MASCOT_IMAGE_PATH = '../images/yokofolia-mascot.png';
  const CANVAS_W = 800;
  const CANVAS_H = 320;
  const GROUND_Y = 260;
  const GRAVITY_RISE_HELD = 0.22;
  const GRAVITY_RISE_RELEASE = 0.58;
  const GRAVITY_FALL = 0.62;
  const JUMP_VELOCITY = -10.5;
  const JUMP_VELOCITY_MAX = -16;
  const BASE_SPEED = 4.5;
  const MAX_SPEED = 13;
  const OBSTACLE_MIN_GAP = 180;
  const OBSTACLE_MAX_GAP = 340;
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
  let jumpHeld = false;

  const player = {
    x: 80,
    y: GROUND_Y,
    w: 44,
    h: 44,
    vy: 0,
    grounded: true
  };

  let obstacles = [];
  let distanceSinceObstacle = 500;

  function nextObstacleGap() {
    return OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP);
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
      if (data.error) throw new Error(data.error);
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
      if (data.error) throw new Error(data.error);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message || 'save failed' };
    }
  }

  function renderRankingList(el, result) {
    if (!result.ok) {
      el.innerHTML = '<p class="cr-ranking-error">ランキング取得に失敗しました</p>';
      return;
    }
    if (result.offline) {
      el.innerHTML = '<p class="cr-ranking-empty">ランキング未設定（GAS_ENDPOINT を設定すると表示されます）</p>';
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
    player.grounded = true;
    obstacles = [];
    distanceSinceObstacle = 500;
    jumpHeld = false;
    updateScoreHud();
  }

  function updateScoreHud() {
    scoreValue.textContent = formatMeters(scoreMeters);
  }

  function jumpStart() {
    if (state !== 'playing') return;
    jumpHeld = true;
    if (player.grounded) {
      player.vy = JUMP_VELOCITY;
      player.grounded = false;
    }
  }

  function jumpEnd() {
    jumpHeld = false;
  }

  function spawnObstacle(x) {
    const types = ['cactus', 'rock', 'tall'];
    const type = types[Math.floor(Math.random() * types.length)];
    let w = 28;
    let h = 36;
    if (type === 'rock') { w = 34; h = 28; }
    if (type === 'tall') { w = 22; h = 52; }
    obstacles.push({
      x,
      y: GROUND_Y + player.h - h,
      w,
      h,
      type
    });
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
    ctx.fillStyle = '#c9a84c';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2 + i * 8, y + h * 0.05);
      ctx.lineTo(x + w * 0.28 + i * 8, y - 4);
      ctx.lineTo(x + w * 0.36 + i * 8, y + h * 0.05);
      ctx.fill();
    }
    ctx.strokeStyle = '#2d4a3d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + h * 0.35, w - 4, h * 0.63);
  }

  function drawObstacle(obs) {
    ctx.fillStyle = '#5a3d4a';
    if (obs.type === 'cactus') {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#7a5560';
      ctx.fillRect(obs.x - 6, obs.y + 8, 8, 14);
      ctx.fillRect(obs.x + obs.w - 2, obs.y + 14, 8, 12);
    } else if (obs.type === 'tall') {
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#e8487a';
      ctx.fillRect(obs.x + 4, obs.y + 6, obs.w - 8, 6);
    } else {
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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
    ctx.fillRect(0, GROUND_Y + player.h, CANVAS_W, CANVAS_H - GROUND_Y - player.h);
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + player.h);
    ctx.lineTo(CANVAS_W, GROUND_Y + player.h);
    ctx.stroke();

    for (const obs of obstacles) {
      drawObstacle(obs);
    }

    drawMascot(player.x, player.y, player.w, player.h);
  }

  function rectsOverlap(a, b) {
    const pad = 4;
    return a.x + pad < b.x + b.w - pad &&
      a.x + a.w - pad > b.x + pad &&
      a.y + pad < b.y + b.h - pad &&
      a.y + a.h - pad > b.y + pad;
  }

  function update(dt) {
    elapsedMs += dt;
    const speedBoost = Math.min((MAX_SPEED - BASE_SPEED), elapsedMs / 12000);
    gameSpeed = BASE_SPEED + speedBoost;

    scoreMeters += (gameSpeed * dt) / 60;
    updateScoreHud();

    if (!player.grounded) {
      let gravity = GRAVITY_FALL;
      if (player.vy < 0) {
        gravity = jumpHeld ? GRAVITY_RISE_HELD : GRAVITY_RISE_RELEASE;
        if (jumpHeld && player.vy > JUMP_VELOCITY_MAX) {
          player.vy = Math.max(JUMP_VELOCITY_MAX, player.vy - 0.35);
        }
      }
      player.vy += gravity;
    }
    player.y += player.vy;

    const floor = GROUND_Y;
    if (player.y >= floor) {
      player.y = floor;
      player.vy = 0;
      player.grounded = true;
    }

    for (const obs of obstacles) {
      obs.x -= gameSpeed;
    }
    obstacles = obstacles.filter(o => o.x + o.w > -20);

    distanceSinceObstacle += gameSpeed;
    if (distanceSinceObstacle >= nextObstacleGap()) {
      spawnObstacle(CANVAS_W + 10);
      distanceSinceObstacle = 0;
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
    } else if (saveResult.offline) {
      saveStatusEl.textContent = 'ランキング未設定のためスコアは保存されませんでした';
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
      jumpStart();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      jumpEnd();
    }
  });

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    jumpStart();
  });

  canvas.addEventListener('pointerup', e => {
    e.preventDefault();
    jumpEnd();
  });

  canvas.addEventListener('pointercancel', jumpEnd);
  canvas.addEventListener('pointerleave', jumpEnd);

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
