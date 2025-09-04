const state = {
  poems: [],
  index: 0,
  touch: { x: 0, y: 0 }
};

const pageEl   = document.getElementById('page');
const titleEl  = document.getElementById('poemTitle');
const progEl   = document.getElementById('progress');
const prevBtn  = document.getElementById('prevBtn');
const nextBtn  = document.getElementById('nextBtn');
const tocBtn   = document.getElementById('tocBtn');
const tocEl    = document.getElementById('toc');
const tapLeft  = document.getElementById('tapLeft');
const tapRight = document.getElementById('tapRight');

init();

async function init() {
  try {
    const res = await fetch('./poems.json', { cache: 'no-store' });
    state.poems = await res.json();
  } catch (e) {
    console.error(e);
    state.poems = [{ id:"err", title:"読み込み失敗", body:"poems.json が見つかりません。" }];
  }
  render();
  bindEvents();
}

function render() {
  const p = clampIndex(state.index);
  const poem = state.poems[p];

  titleEl.textContent = poem.title || "無題";
  pageEl.innerHTML = `
    <article class="poem" role="article" aria-label="${escapeAttr(poem.title)}">
      <h1 style="margin-block:0 1em; font-size:1.1rem; letter-spacing: .05em;">${escapeHTML(poem.title)}</h1>
      <div style="white-space:pre-wrap;">${escapeHTML(poem.body)}</div>
    </article>
  `;
  progEl.textContent = `${p+1} / ${state.poems.length}`;
  buildTOC();
}

function buildTOC() {
  if (!tocEl.dataset.built) {
    const items = state.poems.map((p, i) =>
      `<li><button data-goto="${i}">${escapeHTML(p.title || "無題")}</button></li>`
    ).join("");
    tocEl.innerHTML = `<h2>目次</h2><ul>${items}</ul><div style="margin-top:16px;"><button class="btn" id="tocClose">閉じる</button></div>`;
    tocEl.dataset.built = "1";
    tocEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-goto]');
      if (btn) {
        state.index = Number(btn.dataset.goto);
        hideTOC();
        render();
      }
      if (e.target.id === 'tocClose') hideTOC();
    });
  }
}

function showTOC() { tocEl.classList.remove('hidden'); }
function hideTOC() { tocEl.classList.add('hidden'); }

function next() {
  if (state.index > 0) { // 和書の進行：新しいページは左へ（= 次へでindexを減らす）
    state.index -= 1;
    render();
  }
}
function prev() {
  if (state.index < state.poems.length - 1) {
    state.index += 1;
    render();
  }
}
function clampIndex(i) {
  return Math.min(Math.max(i, 0), state.poems.length - 1);
}

function bindEvents() {
  // 和書の進行に合わせた操作系
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  tocBtn.addEventListener('click', showTOC);

  // タップゾーン：左タップ=次へ（和書の感覚）、右タップ=前へ
  tapLeft.addEventListener('click', next);
  tapRight.addEventListener('click', prev);

  // キー操作（← →）
  window.addEventListener('keydown', (e) => {
    if (tocEl && !tocEl.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft')  next();
    if (e.key === 'ArrowRight') prev();
  });

  // スワイプ（左へスワイプ＝次へ）
  let touching = false;
  pageEl.addEventListener('touchstart', (e) => {
    touching = true;
    state.touch.x = e.touches[0].clientX;
    state.touch.y = e.touches[0].clientY;
  }, { passive: true });

  pageEl.addEventListener('touchmove', (e) => {}, { passive: true });

  pageEl.addEventListener('touchend', (e) => {
    if (!touching) return;
    const dx = (e.changedTouches[0].clientX - state.touch.x);
    touching = false;
    if (dx < -40) next();       // 左へスワイプ → 次へ（和書）
    if (dx >  40) prev();       // 右へスワイプ → 前へ
  });

  // iPadのアドレスバーで高さが変わっても崩れにくく
  window.addEventListener('resize', () => {
    // 必要なら高さ調整や再レイアウトをここで
  });
}

function escapeHTML(s="") {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s="") { return escapeHTML(s).replace(/"/g, '&quot;'); }
