// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — chat.js
// ═══════════════════════════════════════════════════════════════

async function _loadChat() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';
  try {
    const messages = await SS.DB.getMessages(_activeGroup.id);
    _renderMessages(messages);
    container.scrollTop = container.scrollHeight;
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando mensajes</div></div>';
  }
}

function _renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!messages.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">Sé el primero en escribir</div>
        <div class="empty-state-desc">Los mensajes aparecen en tiempo real para todos los miembros</div>
      </div>`;
    return;
  }
  let html = '';
  let lastDate = '';
  let lastUser = '';
  messages.forEach(msg => {
    const date    = new Date(msg.created_at);
    const dateStr = date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'short' });
    if (dateStr !== lastDate) {
      html += `<div class="chat-day-divider">${dateStr}</div>`;
      lastDate = dateStr;
      lastUser = '';
    }
    const isMine   = msg.user_id === _user.id;
    const username = msg.social_profiles?.username || 'Usuario';
    const avatar   = msg.social_profiles?.avatar_url;
    const time     = date.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    const showMeta = lastUser !== msg.user_id;
    lastUser = msg.user_id;
    const avatarHtml = avatar
      ? `<img src="${avatar}" alt="">`
      : `<span>${username.charAt(0).toUpperCase()}</span>`;
    html += `
      <div class="msg ${isMine ? 'mine' : 'theirs'}" id="msg-${msg.id}">
        ${!isMine ? `<div class="msg-avatar">${avatarHtml}</div>` : ''}
        <div>
          ${showMeta ? `<div class="msg-meta">${isMine ? time : username + ' · ' + time}</div>` : ''}
          <div class="msg-bubble" ondblclick="${isMine ? `deleteMsg('${msg.id}')` : ''}"
               title="${isMine ? 'Doble clic para borrar' : ''}">
            ${_renderMsgContent(msg.content)}
          </div>
        </div>
        ${isMine ? `<div class="msg-avatar">${avatarHtml}</div>` : ''}
      </div>`;
  });
  container.innerHTML = html;
}

// Renderiza texto normal o imagen si el contenido es [IMAGE]:data:...
function _renderMsgContent(content) {
  if (content && content.startsWith('[IMAGE]:')) {
    const src = content.slice(8);
    return `<img src="${src}" alt="imagen" style="max-width:260px;max-height:300px;border-radius:10px;display:block;cursor:pointer;" onclick="window.open('${src}','_blank')">`;
  }
  return _escHtml(content);
}

async function _onNewMessage(payload) {
  const msg    = payload.new;
  // Buscar en _members local primero
  let member = _members.find(m => m.id === msg.user_id);
  // Si no está (p.ej. se unió recién), pedir su perfil a Supabase
  if (!member) {
    const { data } = await SS.client
      .from('social_profiles')
      .select('id, username, avatar_url')
      .eq('id', msg.user_id)
      .single();
    if (data) {
      member = data;
      // Agregarlo a _members para futuros mensajes
      _members.push({ ...data, role: 'member' });
      document.getElementById('members-count').textContent = _members.length;
    }
  }
  if (member) msg.social_profiles = { username: member.username, avatar_url: member.avatar_url };
  _appendMessage(msg);
}

function _appendMessage(msg) {
  const container = document.getElementById('chat-messages');
  container.querySelector('.empty-state')?.remove();
  const isMine   = msg.user_id === _user.id;
  const username = msg.social_profiles?.username || 'Usuario';
  const avatar   = msg.social_profiles?.avatar_url;
  const time     = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
  const avatarHtml = avatar ? `<img src="${avatar}" alt="">` : `<span>${username.charAt(0).toUpperCase()}</span>`;
  const div = document.createElement('div');
  div.id = `msg-${msg.id}`;
  div.className = `msg ${isMine ? 'mine' : 'theirs'}`;
  div.innerHTML = `
    ${!isMine ? `<div class="msg-avatar">${avatarHtml}</div>` : ''}
    <div>
      <div class="msg-meta">${isMine ? time : username + ' · ' + time}</div>
      <div class="msg-bubble" ondblclick="${isMine ? `deleteMsg('${msg.id}')` : ''}"
           title="${isMine ? 'Doble clic para borrar' : ''}">
        ${_renderMsgContent(msg.content)}
      </div>
    </div>
    ${isMine ? `<div class="msg-avatar">${avatarHtml}</div>` : ''}
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function _onDeleteMessage(payload) {
  document.getElementById(`msg-${payload.old.id}`)?.remove();
}

async function sendMessage() {
  if (!_activeGroup) return;
  const input   = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  input.style.height = '';
  try {
    await SS.DB.sendMessage(_activeGroup.id, _user.id, content);
  } catch(e) {
    showToast('Error enviando mensaje', 'error');
    input.value = content;
  }
}

// ── Subir imagen al chat ─────────────────────────────────────────

function openChatImagePicker() {
  document.getElementById('chat-image-input').click();
}

async function handleChatImageSelect(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  // Validar tipo y tamaño (máx 3MB)
  if (!file.type.startsWith('image/')) {
    showToast('Solo se permiten imágenes', 'error'); return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showToast('La imagen no debe superar 3MB', 'error'); return;
  }

  showToast('Subiendo imagen...', 'info');
  try {
    const base64 = await _fileToBase64(file);
    await SS.DB.sendMessage(_activeGroup.id, _user.id, '[IMAGE]:' + base64);
  } catch(e) {
    console.error(e);
    showToast('Error enviando imagen', 'error');
  }
}

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

async function deleteMsg(msgId) {
  if (!confirm('¿Borrar este mensaje?')) return;
  try {
    await SS.DB.deleteMessage(msgId);
  } catch(e) {
    showToast('Error borrando mensaje', 'error');
  }
}
