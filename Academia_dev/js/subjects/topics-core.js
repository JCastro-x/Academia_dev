// ═══════════════════════════════════════════════════════════════
// TOPICS CORE — Gestión de temas, subtemas y progreso
// ═══════════════════════════════════════════════════════════════

let compTarget = null;

// ═══════════════════════════════════════════════════════════════
// CRUD DE TEMAS
// ═══════════════════════════════════════════════════════════════

function openTopicModal() {
  fillMatSels();
  document.getElementById('tp-name').value = '';
  document.getElementById('tp-subs').value  = '';
  document.getElementById('modal-topic').classList.add('open');
}

function saveTopic() {
  const name = document.getElementById('tp-name').value.trim(); if (!name) return;
  const subsRaw = document.getElementById('tp-subs').value.trim();
  const subs = subsRaw ? subsRaw.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>({name:s,seen:false,comp:0})) : [];
  State.topics.push({
    id: Date.now().toString(),
    matId: document.getElementById('tp-mat').value,
    parcial: document.getElementById('tp-parcial').value,
    name, seen: false, comp: 0, subs
  });
  saveState(['topics']);
  closeModal('modal-topic');
  window.dispatchEvent(new CustomEvent('topic:created', { detail: { name } }));
}

async function deleteTopic(id) {
  const topic = State.topics.find(t => t.id === id);
  if (!topic) return;
  const confirmed = await showConfirm(`¿Eliminar el tema "${topic.name}"?`, { danger: true });
  if (!confirmed) return;
  const deletedTopic = { ...topic };
  State.topics = State.topics.filter(t=>t.id!==id);
  saveState(['topics']);
  window.dispatchEvent(new CustomEvent('topic:deleted', { detail: { id, name: deletedTopic.name } }));
  if (typeof showUndoToast === 'function') {
    showUndoToast(`Tema "${topic.name}" eliminado`, () => {
      State.topics.push(deletedTopic);
      saveState(['topics']);
      window.dispatchEvent(new CustomEvent('topic:created', { detail: { name: deletedTopic.name } }));
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// PROGRESO DE TEMAS
// ═══════════════════════════════════════════════════════════════

function toggleTopicSeen(id) {
  const t = State.topics.find(x=>x.id===id); if (!t) return;
  t.seen = !t.seen;
  if (t.seen && t.comp===0) t.comp=100;
  if (!t.seen) t.comp=0;
  saveState(['topics']);
  window.dispatchEvent(new CustomEvent('topic:progress', { detail: { id, seen: t.seen, comp: t.comp } }));
}

function toggleSubSeen(tid,idx) {
  const t = State.topics.find(x=>x.id===tid); if (!t?.subs?.[idx]) return;
  t.subs[idx].seen = !t.subs[idx].seen;
  if (t.subs[idx].seen && t.subs[idx].comp===0) t.subs[idx].comp=100;
  if (!t.subs[idx].seen) t.subs[idx].comp=0;
  saveState(['topics']);
  window.dispatchEvent(new CustomEvent('topic:progress', { detail: { tid, idx, seen: t.subs[idx].seen } }));
}

function openCompPopup(e,topicId,subIdx) {
  e.stopPropagation();
  compTarget = { topicId, subIdx: subIdx!=null ? subIdx : null };
  const t   = State.topics.find(x=>x.id===topicId);
  const cur = subIdx!=null ? t.subs[subIdx].comp : t.comp;
  const slider = document.getElementById('comp-slider');
  slider.value = cur;
  document.getElementById('comp-val').textContent = cur+'%';
  slider.oninput = () => { document.getElementById('comp-val').textContent = slider.value+'%'; };
  const popup = document.getElementById('comp-popup');
  popup.style.display = 'block';
  const rect = e.currentTarget.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 8 + window.scrollY) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth-200) + 'px';
}

function applyComp() {
  if (!compTarget) return;
  const val = parseInt(document.getElementById('comp-slider').value)||0;
  const t   = State.topics.find(x=>x.id===compTarget.topicId);
  if (t) { if (compTarget.subIdx!=null) t.subs[compTarget.subIdx].comp=val; else t.comp=val; }
  saveState(['topics']);
  closeCompPopup();
  window.dispatchEvent(new CustomEvent('topic:progress', { detail: { id: compTarget.topicId, comp: val } }));
}

function closeCompPopup() { const p=document.getElementById('comp-popup'); if(p) p.style.display='none'; compTarget=null; }

// ═══════════════════════════════════════════════════════════════
// RENDERIZADO DE TEMAS
// ═══════════════════════════════════════════════════════════════

if (typeof window.renderTopics !== 'function') {
  window.renderTopics = function() {
    const matId = document.getElementById('topics-mat-sel')?.value || '';
    const container = document.getElementById('topics-container');
    if (!container) return;
    if (!matId) { container.innerHTML=''; return; }
    const mat      = getMat(matId);
    const matTopics = State.topics.filter(t=>t.matId===matId);
    const totalT   = matTopics.length, seenT = matTopics.filter(t=>t.seen).length;
    const avgComp  = totalT ? Math.round(matTopics.reduce((a,t)=>a+t.comp,0)/totalT) : 0;
    const needRev  = matTopics.filter(t=>t.comp<70&&t.seen).length;

    let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
      <div class="stat-mini"><div class="stat-mini-lbl">✅ TEMAS VISTOS</div><div class="stat-mini-val" style="color:#4ade80;">${seenT}<span style="font-size:13px;color:var(--text3);">/${totalT}</span></div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:#4ade80;width:${totalT?seenT/totalT*100:0}%;"></div></div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">🧠 COMPRENSIÓN</div><div class="stat-mini-val" style="color:${barColor(avgComp)};">${avgComp}%</div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:${barColor(avgComp)};width:${avgComp}%;"></div></div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">⚠️ REPASO</div><div class="stat-mini-val" style="color:#fbbf24;">${needRev}</div><div style="font-size:11px;color:var(--text3);margin-top:4px;">&lt;70% comprensión</div></div>
    </div>`;

    const parcials = [{v:'1',l:'Parcial 1'},{v:'2',l:'Parcial 2'},{v:'3',l:'Parcial 3'},{v:'final',l:'Final'}];
    let anyFound = false;
    parcials.forEach(p => {
      const pts = matTopics.filter(t=>t.parcial===p.v);
      if (!pts.length) return;
      anyFound = true;
      const pSeen = pts.filter(t=>t.seen).length;
      const pComp = pts.length ? Math.round(pts.reduce((a,t)=>a+t.comp,0)/pts.length) : 0;
      html += `<div class="card" style="margin-bottom:14px;">
        <div class="card-header" style="border-left:3px solid ${mat.color};">
          <span class="card-title" style="padding-left:8px;">📖 ${p.l}</span>
          <div style="display:flex;gap:10px;align-items:center;">
            <span style="font-size:11px;color:var(--text3);">${pSeen}/${pts.length} vistos</span>
            <span style="font-size:11px;font-weight:700;color:${barColor(pComp)};">Comprensión: ${pComp}%</span>
          </div>
        </div>
        <div class="card-body">
          ${pts.map(t => {
            const subsHtml = t.subs.length
              ? `<div style="padding-left:28px;margin-top:4px;border-left:2px solid var(--border);margin-left:10px;">
                  ${t.subs.map((s,i)=>`
                    <div class="topic-item" style="padding:6px 0;">
                      <div class="topic-seen-btn ${s.seen?'seen':''}" onclick="toggleSubSeen('${t.id}',${i})"></div>
                      <div style="flex:1;font-size:12px;color:${s.seen?'var(--text2)':'var(--text)'};">${s.name}</div>
                      <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',${i})">
                        <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${s.comp}%;background:${barColor(s.comp)};border-radius:3px;transition:width .3s;"></div></div>
                        <span style="font-size:10px;font-family:'Space Mono',monospace;color:${barColor(s.comp)};width:30px;text-align:right;">${s.comp}%</span>
                      </div>
                    </div>`).join('')}
              </div>` : '';
            return `<div>
              <div class="topic-item">
                <div class="topic-seen-btn ${t.seen?'seen':''}" onclick="toggleTopicSeen('${t.id}')"></div>
                <div style="flex:1;font-size:13.5px;font-weight:600;color:${t.seen?'var(--text2)':'var(--text)'};">${t.name}</div>
                <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',null)">
                  <div style="width:90px;height:6px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${t.comp}%;background:${barColor(t.comp)};border-radius:4px;transition:width .3s;"></div></div>
                  <span style="font-size:11px;font-family:'Space Mono',monospace;color:${barColor(t.comp)};width:34px;text-align:right;">${t.comp}%</span>
                </div>
                <button class="btn btn-danger btn-sm" style="margin-left:6px;" onclick="deleteTopic('${t.id}')">✕</button>
              </div>
              ${subsHtml}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    });
    if (!anyFound) html += `<div style="text-align:center;padding:48px;color:var(--text3);">📖 Presiona "+ Agregar Tema" para comenzar</div>`;
    container.innerHTML = html;
  };
}

// ═══════════════════════════════════════════════════════════════
// LISTENERS DE CUSTOM EVENTS
// ═══════════════════════════════════════════════════════════════
window.addEventListener('topic:created', () => { renderTopics(); });
window.addEventListener('topic:deleted', () => { renderTopics(); });
window.addEventListener('topic:progress', () => { renderTopics(); renderGeneralHub(); });
window.addEventListener('subject:switched', () => { renderTopics(); });

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.openTopicModal  = openTopicModal;
window.saveTopic       = saveTopic;
window.deleteTopic     = deleteTopic;
window.toggleTopicSeen = toggleTopicSeen;
window.toggleSubSeen   = toggleSubSeen;
window.openCompPopup   = openCompPopup;
window.applyComp       = applyComp;
window.closeCompPopup  = closeCompPopup;
