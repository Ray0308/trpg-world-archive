(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const PRIZES = [
    { emoji: '🐙', label: 'たこ' },
    { emoji: '🦑', label: 'いか' },
    { emoji: '🐡', label: 'ふぐ' },
    { emoji: '🌸', label: '花' },
    { emoji: '⭐', label: '星' },
    { emoji: '🎲', label: 'ダイス' }
  ];

  const state = {
    running: false,
    busy: false,
    craneX: W / 2,
    ropeY: 48,
    clawOpen: true,
    held: null,
    score: 0,
    prizes: [],
    moveLeft: false,
    moveRight: false
  };

  const ROPE_MIN = 48;
  const ROPE_MAX = 300;
  const CRANE_SPEED = 3.2;
  const ROPE_SPEED = 2.4;
  const CLAW_W = 44;

  function initPrizes() {
    const cols = 3;
    const startX = 50;
    const startY = 330;
    const gapX = 95;
    const gapY = 52;
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

  function drawMachine() {
    ctx.fillStyle = '#1e1e2a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#12121a';
    ctx.fillRect(12, 280, W - 24, H - 292);

    ctx.strokeStyle = 'rgba(232, 72, 122, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 280, W - 24, H - 292);

    ctx.fillStyle = '#e8487a';
    ctx.fillRect(W - 54, 292, 40, H - 304);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px sans-serif';
    ctx.fillText('OUT', W - 46, 310);

    state.prizes.forEach(p => {
      if (p.taken && state.held !== p) return;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const py = p === state.held ? state.ropeY + 34 : p.y;
      const px = p === state.held ? state.craneX : p.x;
      ctx.fillText(p.emoji, px, py);
    });

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.craneX, 0);
    ctx.lineTo(state.craneX, state.ropeY);
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.fillRect(state.craneX - 28, 8, 56, 18);

    ctx.fillStyle = state.clawOpen ? '#ccc' : '#e8487a';
    const clawY = state.ropeY + 8;
    ctx.beginPath();
    ctx.moveTo(state.craneX, clawY);
    ctx.lineTo(state.craneX - (state.clawOpen ? 22 : 14), clawY + 24);
    ctx.lineTo(state.craneX - 8, clawY + 18);
    ctx.lineTo(state.craneX, clawY + 10);
    ctx.lineTo(state.craneX + 8, clawY + 18);
    ctx.lineTo(state.craneX + (state.clawOpen ? 22 : 14), clawY + 24);
    ctx.closePath();
    ctx.fill();
  }

  function updateCollection() {
    const panel = document.getElementById('collectionPanel');
    const list = document.getElementById('collectionList');
    const scoreEl = document.getElementById('scoreValue');
    scoreEl.textContent = String(state.score);
    if (!state.score) {
      panel.hidden = true;
      list.innerHTML = '';
      return;
    }
    panel.hidden = false;
    list.innerHTML = state.prizes
      .filter(p => p.taken)
      .map(p => `<li title="${p.label}">${p.emoji}</li>`)
      .join('');
  }

  async function dropSequence() {
    if (!state.running || state.busy) return;
    state.busy = true;
    document.getElementById('btnDrop').disabled = true;

    while (state.ropeY < ROPE_MAX) {
      state.ropeY += ROPE_SPEED;
      drawMachine();
      await wait(16);
    }

    const target = nearestPrize(state.craneX);
    const aligned = target && Math.abs(target.x - state.craneX) < 26;
    state.clawOpen = false;
    drawMachine();
    await wait(280);

    if (target && aligned && Math.random() < 0.72) {
      state.held = target;
      target.taken = true;
    }

    while (state.ropeY > ROPE_MIN) {
      state.ropeY -= ROPE_SPEED * 0.9;
      drawMachine();
      await wait(16);
    }

    if (state.held) {
      const destX = W - 34;
      while (Math.abs(state.craneX - destX) > 2) {
        state.craneX += Math.sign(destX - state.craneX) * CRANE_SPEED;
        drawMachine();
        await wait(16);
      }
      state.craneX = destX;
      state.clawOpen = true;
      state.score += 1;
      state.held = null;
      updateCollection();
      drawMachine();
      await wait(200);
      while (state.craneX > W / 2) {
        state.craneX -= CRANE_SPEED;
        drawMachine();
        await wait(16);
      }
    } else {
      state.clawOpen = true;
      drawMachine();
    }

    state.busy = false;
    document.getElementById('btnDrop').disabled = false;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function gameLoop() {
    if (!state.running) return;
    if (!state.busy) {
      if (state.moveLeft) state.craneX = Math.max(30, state.craneX - CRANE_SPEED);
      if (state.moveRight) state.craneX = Math.min(W - 30, state.craneX + CRANE_SPEED);
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

  function startGame() {
    document.getElementById('startScreen').hidden = true;
    state.running = true;
    state.busy = false;
    state.score = 0;
    state.craneX = W / 2;
    state.ropeY = ROPE_MIN;
    state.clawOpen = true;
    state.held = null;
    initPrizes();
    updateCollection();
    gameLoop();
  }

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('btnDrop').addEventListener('click', dropSequence);

  bindHold(document.getElementById('btnLeft'), 'moveLeft', true);
  bindHold(document.getElementById('btnRight'), 'moveRight', true);

  document.addEventListener('keydown', e => {
    if (!state.running || state.busy) return;
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

  initPrizes();
  drawMachine();
})();
