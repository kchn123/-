// ==== 状態 ====
const state = { poems: [], index: 0, touch: { x: 0, y: 0 } };

// ==== 要素 ====
const pageEl = document.getElementById('page');
const titleEl = document.getElementById('poemTitle');
const progEl = document.getElementById('progress');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const tocBtn  = document.getElementById('tocBtn');
const tocEl   = document.getElementById('toc');

// ==== 初期化 ====
init();
async function init() {
  try {
    const res = await fetch('./poems.json?v=16', { cache: 'no-store' });
    state.poems = await res.json();
    if (!Array.isArray(state.poems) || state.poems.length === 0) throw new Error('no poems');
  } catch (e) {
    console.error(e);
    state.poems = [{ id:"err", title:"読み込み失敗", body:"poems.json を確認してください。", keywords:[] }];
  }
  render();
  bindEvents();
}

// ==== レンダリング（1見開き = 1篇） ====
function render() {
  const p = clampIndex(state.index);
  const poem = state.poems[p];
  titleEl.textContent = poem.title || "無題";

  // 見開きON（横向き運用）
  pageEl.classList.add('spread');

  // 同じ詩を「右=前半／左=後半」に二分割
  const halves = splitBody(poem.body);

  pageEl.innerHTML = `
    <section class="leaf right" data-poem-id="${escapeAttr(poem.id)}">
      <article class="poem" aria-label="${escapeAttr(poem.title)}">
        <h1 style="margin-block:0 1em; font-size:1.1rem; letter-spacing:.05em;">${escapeHTML(poem.title)}</h1>
        <div class="poemBodyR" style="white-space:pre-wrap;">${escapeHTML(halves.right)}</div>
      </article>
    </section>
    <section class="leaf left" data-poem-id="${escapeAttr(poem.id)}" style="${halves.left ? '' : 'display:none;'}">
      <article class="poem" aria-label="${escapeAttr(poem.title)}（続き）">
        <div class="poemBodyL" style="white-space:pre-wrap;">${escapeHTML(halves.left)}</div>
      </article>
    </section>
  `;

  // はみ出し防止（縦スクロール禁止のため微縮小）
  fitToLeaf(document.querySelector('.leaf.right .poem'));
  if (halves.left) fitToLeaf(document.querySelector('.leaf.left .poem'));

  progEl.textContent = `${p+1} / ${state.poems.length}`;
  buildTOC();
}

function clampIndex(i) { return Math.min(Math.max(i, 0), state.poems.length - 1); }

// ==== 目次 ====
function buildTOC() {
  if (!tocEl.dataset.built) {
    const items = state.poems.map((p, i) =>
      `<li><button data-goto="${i}">${escapeHTML(p.title || "無題")}</button></li>`
    ).join("");
    tocEl.innerHTML = `<h2>目次</h2><ul style="list-style:none;padding:0;margin:0;columns:2;gap:24px;">${items}</ul><div style="margin-top:16px;"><button class="btn" id="tocClose">閉じる</button></div>`;
    tocEl.dataset.built = "1";
    tocEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-goto]');
      if (btn) { state.index = Number(btn.dataset.goto); hideTOC(); render(); }
      if (e.target.id === 'tocClose') hideTOC();
    });
  }
}
function showTOC(){ tocEl.classList.remove('hidden'); }
function hideTOC(){ tocEl.classList.add('hidden'); }

// ==== ナビ（和書仕様：次へ = index を減らす） ====
function next(){ if (state.index > 0) { state.index -= 1; render(); } }
function prev(){ if (state.index < state.poems.length - 1) { state.index += 1; render(); } }

// ==== スワイプのみ（タップ無効） ====
function bindEvents() {
  prevBtn && prevBtn.removeEventListener('click', prev);
  nextBtn && nextBtn.removeEventListener('click', next);
  tocBtn  && tocBtn.addEventListener('click', showTOC);

  const surface = document.getElementById('reader');
  let touching=false, sx=0, sy=0;

  surface.addEventListener('touchstart', (e)=>{
    touching=true; sx=e.touches[0].clientX; sy=e.touches[0].clientY;
  }, {passive:true});

  surface.addEventListener('touchmove', (e)=>{
    if(!touching) return;
    const dx=e.touches[0].clientX - sx;
    const dy=e.touches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault(); // 縦スクロール抑止
  }, {passive:false});

  surface.addEventListener('touchend', (e)=>{
    if(!touching) return; touching=false;
    const dx=e.changedTouches[0].clientX - sx;
    const dy=e.changedTouches[0].clientY - sy;
    const TH=40;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > TH) {
      if (dx < 0) next(); else prev();
    }
  }, {passive:false});

  window.addEventListener('resize', ()=>render());
}

// ==== 本文分割（右→左） ====
function splitBody(body="") {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length <= 12) return { right: body, left: "" };
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

// ==== 縦スクロール無しで収める（自動微縮小） ====
function fitToLeaf(poemEl) {
  if (!poemEl) return;
  const leaf = poemEl.closest('.leaf');
  if (!leaf) return;
  let size = 18, min = 12, tries = 0;
  poemEl.style.fontSize = size + "px";
  while (tries < 30 && (poemEl.scrollHeight > leaf.clientHeight)) {
    size -= 0.5;
    if (size < min) break;
    poemEl.style.fontSize = size + "px";
    tries++;
  }
}

// ==== ヘルパ ====
function escapeHTML(s=""){return s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function escapeAttr(s=""){return escapeHTML(s).replace(/"/g,'&quot;')}
