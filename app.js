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
    const res = await fetch('./poems.json?v=10', { cache: 'no-store' });
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

  // 見開きクラスを常時付与（横向き運用）
  pageEl.classList.add('spread');

  // 本文を二分割（右→左）。短文は右だけ。
  const halves = splitBody(poem.body);

  pageEl.innerHTML = `
    <section class="leaf right">
      <article class="poem" aria-label="${escapeAttr(poem.title)}">
        <h1 style="margin-block:0 1em; font-size:1.1rem; letter-spacing:.05em;">${escapeHTML(poem.title)}</h1>
        <div class="poemBodyR" style="white-space:pre-wrap;">${escapeHTML(halves.right)}</div>
      </article>
    </section>
    <section class="leaf left" style="${halves.left ? '' : 'display:none;'}">
      <article class="poem" aria-label="${escapeAttr(poem.title)}（続き）">
        <div class="poemBodyL" style="white-space:pre-wrap;">${escapeHTML(halves.left)}</div>
      </article>
    </section>
  `;

  // 文字量が多い場合でも縦スクロールせず、字サイズを自動微調整
  fitToLeaf(document.querySelector('.leaf.right .poem'));
  if (halves.left) fitToLeaf(document.querySelector('.leaf.left .poem'));

  progEl.textContent = `${p+1} / ${state.poems.length}`;
  buildTOC();
}

function splitBody(body="") {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length <= 12) {
    // 短い詩は右ページだけに載せて左は空
    return { right: body, left: "" };
  }
  // 中央付近で気持ちよく切る（空行/句点の近くを優先）
  const mid = Math.ceil(lines.length / 2);
  let cut = mid;
  for (let d = 0; d < Math.min(6, lines.length); d++) {
    const i1 = mid - d, i2 = mid + d;
    const ok1 = i1 > 1 && (/^[\s　]*$/.test(lines[i1]) || /[。．！？!.?、，,：:；;]$/.test((lines[i1-1]||"").trim()));
    const ok2 = i2 < lines.length-1 && (/^[\s　]*$/.test(lines[i2]) || /[。．！？!.?、，,：:；;]$/.test((lines[i2-1]||"").trim()));
    if (ok1) { cut = i1; break; }
    if (ok2) { cut = i2; break; }
  }
  const right = lines.slice(0, cut).join("\n").trimEnd();
  const left  = lines.slice(cut).join("\n").trimStart();
  return { right, left };
}

function fitToLeaf(poemEl) {
  if (!poemEl) return;
  const leaf = poemEl.closest('.leaf');
  if (!leaf) return;
  const bodyEl = poemEl;

  // 基準フォントサイズ（px）を徐々に下げる
  let size = 18;          // 基準
  const min = 12;         // 最小
  poemEl.style.fontSize = size + "px";

  // はみ出していたら縮める（最大30回）
  let tries = 0;
  while (tries < 30 && (bodyEl.scrollHeight > leaf.clientHeight)) {
    size -= 0.5;
    if (size < min) break;
    poemEl.style.fontSize = size + "px";
    tries++;
  }
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
  // 既存のボタン類は使わない（CSSで非表示）
  prevBtn && prevBtn.removeEventListener('click', prev);
  nextBtn && nextBtn.removeEventListener('click', next);
  tocBtn && tocBtn.addEventListener('click', showTOC);

  const surface = document.getElementById('reader'); // 画面全体でスワイプ
  let touching = false, sx = 0, sy = 0;

  surface.addEventListener('touchstart', (e) => {
    touching = true;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });

  surface.addEventListener('touchmove', (e) => {
    if (!touching) return;
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    // 横スワイプ中は縦スクロールを抑止
    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
  }, { passive: false });

  surface.addEventListener('touchend', (e) => {
    if (!touching) return;
    touching = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    const TH = 40; // 判定しきい値(px)

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > TH) {
      if (dx < 0) next(); // 左へスワイプ＝次へ（和書）
      else prev();        // 右へスワイプ＝前へ
    }
  }, { passive: false });

  // 画面サイズ変化（回転など）で再描画
  window.addEventListener('resize', () => render());
}


function escapeHTML(s="") {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s="") { return escapeHTML(s).replace(/"/g, '&quot;'); }
