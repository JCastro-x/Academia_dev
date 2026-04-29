/* ═══════════════════════════════════════════════════════════
   SKELETON LOADING STATES  v1.0
   ─ Placeholders mientras carga contenido
   ═══════════════════════════════════════════════════════════ */

// ── Skeleton Templates ───────────────────────────────────────────────
const SKELETON_TEMPLATES = {
  card: `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-title"></div>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `,
  
  list: `
    <div class="skeleton-list">
      <div class="skeleton-item">
        <div class="skeleton-icon"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
      <div class="skeleton-item">
        <div class="skeleton-icon"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
      <div class="skeleton-item">
        <div class="skeleton-icon"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    </div>
  `,
  
  grid: `
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `,
  
  table: `
    <div class="skeleton-table">
      <div class="skeleton-row header">
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
      </div>
      <div class="skeleton-row">
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
      </div>
      <div class="skeleton-row">
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell"></div>
      </div>
    </div>
  `
};

// ── Show/Hide Skeletons ───────────────────────────────────────────────
function showSkeleton(container, type = 'card', count = 3) {
  if (!container) return;
  
  let html = '';
  for (let i = 0; i < count; i++) {
    html += SKELETON_TEMPLATES[type] || SKELETON_TEMPLATES.card;
  }
  
  container.innerHTML = html;
  container.classList.add('skeleton-loading');
}

function hideSkeleton(container, realContent) {
  if (!container) return;
  
  container.classList.remove('skeleton-loading');
  container.innerHTML = realContent;
}

// ── Wrap Async Operations with Skeleton ───────────────────────────────
async function withSkeleton(container, type, asyncFn, count = 3) {
  showSkeleton(container, type, count);
  
  try {
    const result = await asyncFn();
    return result;
  } finally {
    // Content will be set by the caller
    container.classList.remove('skeleton-loading');
  }
}

// ── CSS Styles ──────────────────────────────────────────────────────
const skeletonStyles = `
<style>
.skeleton-loading {
  opacity: 0.7;
}

/* Skeleton Card */
.skeleton-card {
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--border);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-title {
  flex: 1;
  height: 20px;
  background: var(--border);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  background: var(--border);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.3s;
}

.skeleton-line.short {
  width: 60%;
  animation-delay: 0.4s;
}

/* Skeleton List */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface2);
  border-radius: 8px;
}

.skeleton-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--border);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Skeleton Grid */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* Skeleton Table */
.skeleton-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--surface2);
  border-radius: 8px;
}

.skeleton-row.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.skeleton-cell {
  flex: 1;
  height: 16px;
  background: var(--border);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

/* Animation */
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
`;

// Inject styles
if (!document.getElementById('skeleton-styles')) {
  const styleEl = document.createElement('div');
  styleEl.id = 'skeleton-styles';
  styleEl.innerHTML = skeletonStyles;
  document.head.appendChild(styleEl);
}

