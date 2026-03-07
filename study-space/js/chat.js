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
            ${_escHtml(msg.content)}
          </div>
        </div>
        ${isMine ? `<div class="msg-avatar">${avatarHtml}</div>` : ''}
      </div>`;
  });
  container.innerHTML = html;
}

function _onNewMessage(payload) {
  const msg    = payload.new;
  const member = _members.find(m => m.id === msg.user_id);
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
        ${_escHtml(msg.content)}
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
