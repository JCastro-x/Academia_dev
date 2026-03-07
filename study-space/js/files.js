// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — files.js
// ═══════════════════════════════════════════════════════════════

let _files = [];

async function _loadFiles() {
  _files = await SS.DB.getFiles(_activeGroup.id);
  _renderFiles();
}

function _renderFiles() {
  const grid = document.getElementById('files-grid');
  const uploadZone = `
    <div class="upload-zone" id="upload-zone"
      onclick="document.getElementById('file-input').click()"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="handleFileDrop(event)">
      <div class="upload-zone-icon">📂</div>
      <div class="upload-zone-text">Arrastra archivos aquí o haz clic</div>
      <div class="upload-zone-sub">PDF, imágenes, documentos (máx. 5MB)</div>
    </div>`;

  if (!_files.length) { grid.innerHTML = uploadZone; return; }

  const fileIcon = t => t === 'pdf' ? '📑' : t === 'image' ? '🖼️' : '📄';
  const fileSize = s => s ? (s < 1024*1024 ? Math.round(s/1024) + ' KB' : (s/1024/1024).toFixed(1) + ' MB') : '';

  grid.innerHTML = uploadZone + _files.map(f => `
    <div class="file-card" onclick="_openFile('${f.id}')">
      <div class="file-icon">${fileIcon(f.file_type)}</div>
      <div>
        <div class="file-name">${_escHtml(f.name)}</div>
        <div class="file-meta">${fileSize(f.size)} · ${_timeAgo(f.created_at)}</div>
        <div class="file-uploader">👤 ${_escHtml(f.social_profiles?.username || 'alguien')}</div>
      </div>
      <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();_deleteFile('${f.id}')" style="margin-top:auto;">🗑️</button>
    </div>
  `).join('');
}

async function handleFileUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length || !_activeGroup) return;
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { showToast(`${file.name} supera 5MB`, 'error'); continue; }
    showToast(`Subiendo ${file.name}...`, 'info');
    try {
      const uploaded = await SS.DB.uploadFile(_activeGroup.id, _user.id, file);
      _files.unshift(uploaded);
      showToast(`${file.name} subido ✓`, 'success');
    } catch(e) {
      showToast(`Error subiendo ${file.name}`, 'error');
    }
  }
  _renderFiles();
  event.target.value = '';
}

function handleFileDrop(event) {
  event.preventDefault();
  document.getElementById('upload-zone')?.classList.remove('drag-over');
  const files = Array.from(event.dataTransfer.files);
  if (!files.length) return;
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  document.getElementById('file-input').files = dt.files;
  handleFileUpload({ target: document.getElementById('file-input') });
}

function _openFile(fileId) {
  const file = _files.find(f => f.id === fileId);
  if (!file) return;
  const byteStr = atob(file.data.split(',')[1]);
  const ab      = new ArrayBuffer(byteStr.length);
  const ia      = new Uint8Array(ab);
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  const blob = new Blob([ab], { type: file.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function _deleteFile(fileId) {
  if (!confirm('¿Borrar este archivo?')) return;
  await SS.DB.deleteFile(fileId);
  _files = _files.filter(f => f.id !== fileId);
  _renderFiles();
  showToast('Archivo borrado', 'info');
}
