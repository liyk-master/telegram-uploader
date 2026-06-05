document.addEventListener('DOMContentLoaded', async () => {
  const apiKey = localStorage.getItem('api_key');

  if (!apiKey) {
    showLogin();
    return;
  }

  try {
    const data = await apiRequest('/api/user/stats');
    renderDashboard(data);
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-main').style.display = 'block';
  } catch (err) {
    showLogin();
  }

  initUploadArea();
  initDirUpload();
  initUploadTabs();
});

function showLogin() {
  const section = document.getElementById('login-section');
  section.style.display = 'block';

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('login-key').value.trim();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '验证中…';

    try {
      localStorage.setItem('api_key', key);
      const data = await apiRequest('/api/user/stats');
      renderDashboard(data);
      section.style.display = 'none';
      document.getElementById('dashboard-main').style.display = 'block';
    } catch (err) {
      localStorage.removeItem('api_key');
      alert('API Key 无效，请重新输入');
    } finally {
      btn.disabled = false;
      btn.textContent = '登录';
    }
  });
}

function renderDashboard(data) {
  const { user, uploads } = data;

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-key').textContent = user.api_key;
  document.getElementById('upload-count').textContent = user.upload_count;
  document.getElementById('total-size').textContent = formatSize(user.total_size);

  const tbody = document.getElementById('upload-history');
  tbody.innerHTML = '';

  if (uploads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">📄</span><p>暂无上传记录</p></div></td></tr>';
  } else {
    uploads.forEach((u, i) => {
      const tr = document.createElement('tr');
      tr.style.animation = `slideIn 0.25s ease both ${i * 0.05}s`;
      tr.innerHTML = `
        <td>${escapeHtml(u.file_name)}</td>
        <td>${formatSize(u.file_size)}</td>
        <td>${u.file_path ? escapeHtml(u.file_path) : '-'}</td>
        <td>${escapeHtml(u.caption) || '-'}</td>
        <td><span class="status-${u.status}">${u.status}</span></td>
        <td>${u.created_at}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  loadLeaderboard();

  if (user.is_admin) {
    initAdminPanel();
  }

  document.getElementById('copy-key').addEventListener('click', () => {
    const key = document.getElementById('user-key').textContent;
    navigator.clipboard.writeText(key).then(() => alert('已复制'));
  });
}

async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-container');

  try {
    const data = await apiRequest('/api/leaderboard');
    const { leaders, me } = data;

    if (!leaders || leaders.length === 0) return;

    const list = document.createElement('div');
    list.className = 'leaderboard-list';

    leaders.forEach((u, i) => {
      const isMe = me && u.name === me.name;
      const rank = i + 1;
      let rankClass = '';
      let rankDisplay = rank;

      if (rank === 1) rankClass = 'gold';
      else if (rank === 2) rankClass = 'silver';
      else if (rank === 3) rankClass = 'bronze';

      if (rank <= 3) {
        const medals = ['🥇', '🥈', '🥉'];
        rankDisplay = medals[rank - 1];
      }

      const item = document.createElement('div');
      item.className = `leaderboard-item${isMe ? ' is-me' : ''}`;
      item.style.animationDelay = `${i * 0.06}s`;
      item.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name${isMe ? ' is-me-name' : ''}">
            ${escapeHtml(u.name)}
            ${isMe ? '<span class="you-label">你</span>' : ''}
          </div>
          <div class="leaderboard-detail">${formatSize(u.total_size)} 总量</div>
        </div>
        <div class="leaderboard-stat">
          <div class="lb-count">${u.upload_count}</div>
          <div class="lb-label">次上传</div>
        </div>
      `;
      list.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(list);
  } catch (err) {
    // silent
  }
}

async function initAdminPanel() {
  const panel = document.getElementById('admin-panel');
  panel.style.display = 'block';

  await loadRegCodes();

  document.getElementById('generate-code').addEventListener('click', async () => {
    const btn = document.getElementById('generate-code');
    btn.disabled = true;
    btn.textContent = '生成中…';

    try {
      const data = await apiRequest('/api/admin/reg-codes', { method: 'POST' });
      document.getElementById('new-code').textContent = data.code;
      document.getElementById('new-code-result').style.display = 'block';
      await loadRegCodes();
    } catch (err) {
      alert('生成失败：' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '生成注册码';
    }
  });

  document.getElementById('copy-new-code').addEventListener('click', () => {
    const code = document.getElementById('new-code').textContent;
    navigator.clipboard.writeText(code).then(() => alert('已复制'));
  });

  initUserManagement();
}

async function initUserManagement() {
  const panel = document.getElementById('admin-users-panel');
  panel.style.display = 'block';

  await loadUsers();
}

async function loadUsers() {
  const data = await apiRequest('/api/admin/reset-key');
  const tbody = document.getElementById('users-list');
  tbody.innerHTML = '';

  if (data.users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">👤</span><p>暂无用户</p></div></td></tr>';
    return;
  }

  data.users.forEach((u, i) => {
    const tr = document.createElement('tr');
    tr.style.animation = `slideIn 0.2s ease both ${i * 0.04}s`;
    tr.innerHTML = `
      <td>${escapeHtml(u.name)}</td>
      <td>${u.upload_count}</td>
      <td>${formatSize(u.total_size)}</td>
      <td>${u.created_at}</td>
      <td><button class="btn-sm" data-user-id="${u.id}" data-user-name="${escapeHtml(u.name)}">重置 Key</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-user-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      resetUserKey(parseInt(btn.dataset.userId), btn.dataset.userName, btn);
    });
  });
}

async function resetUserKey(userId, userName, btn) {
  if (!confirm(`确定要重置用户 "${userName}" 的 API Key 吗？此操作不可撤销。`)) return;

  btn.disabled = true;
  btn.textContent = '重置中…';

  try {
    const data = await apiRequest('/api/admin/reset-key', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    prompt(`用户 "${data.user_name}" 的 API Key 已重置为新 Key:\n\n请告知用户新 Key。`, data.new_api_key);
  } catch (err) {
    alert('重置失败：' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '重置 Key';
  }

  try { await loadUsers(); } catch (e) { /* ignore */ }
}

async function loadRegCodes() {
  const data = await apiRequest('/api/admin/reg-codes');
  const tbody = document.getElementById('reg-codes-list');
  tbody.innerHTML = '';

  if (data.codes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">🔑</span><p>暂无注册码</p></div></td></tr>';
    return;
  }

  data.codes.forEach((c, i) => {
    const used = c.used_by ? '已使用' : '未使用';
    const statusClass = c.used_by ? 'success' : 'pending';
    const usedBy = c.used_by_name || '-';
    const usedAt = c.used_at || '-';
    const tr = document.createElement('tr');
    tr.style.animation = `slideIn 0.2s ease both ${i * 0.04}s`;
    tr.innerHTML = `
      <td><code>${escapeHtml(c.code)}</code></td>
      <td><span class="status-${statusClass}">${used}</span></td>
      <td>${escapeHtml(usedBy)}</td>
      <td>${c.created_at}</td>
      <td>${usedAt}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* === Upload Tabs === */
function initUploadTabs() {
  const tabs = document.querySelectorAll('.upload-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      document.querySelectorAll('.upload-mode').forEach(el => {
        el.style.display = el.dataset.mode === mode ? '' : 'none';
      });
    });
  });
}

/* === Single file upload === */
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = '上传中…';

  try {
    await apiRequest('/api/upload', {
      method: 'POST',
      body: formData,
    });

    showAlert(e.target, '上传成功！', 'success');

    document.getElementById('upload-form').reset();
    document.getElementById('file-info').style.display = 'none';

    await refreshStats();
    loadLeaderboard();
  } catch (err) {
    showAlert(e.target, '上传失败：' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '上传到频道';
  }
});

function initUploadArea() {
  const area = document.getElementById('upload-area');
  const fileInput = document.getElementById('file');
  const fileInfo = document.getElementById('file-info');

  area.addEventListener('click', () => fileInput.click());

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });

  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });

  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      showFileInfo(fileInput.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      showFileInfo(fileInput.files[0]);
    }
  });

  function showFileInfo(file) {
    fileInfo.style.display = 'block';
    fileInfo.textContent = `${file.name} · ${formatSize(file.size)}`;
  }
}

/* === Directory upload === */
function initDirUpload() {
  const area = document.getElementById('dir-upload-area');
  const picker = document.getElementById('dir-picker');

  area.addEventListener('click', () => picker.click());

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });

  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });

  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.items?.length) {
      picker.files = e.dataTransfer.files;
      handleDirPick();
    }
  });

  picker.addEventListener('change', handleDirPick);
}

function handleDirPick() {
  const picker = document.getElementById('dir-picker');
  const files = Array.from(picker.files).filter(f => f.name.endsWith('.cas'));
  const nonCas = Array.from(picker.files).filter(f => !f.name.endsWith('.cas'));

  if (files.length === 0) {
    showAlert(document.getElementById('dir-upload-area'), '目录中没有找到 .cas 文件', 'error');
    return;
  }

  buildFileTree(files, nonCas.length);
}

function buildFileTree(files, skipped) {
  const container = document.getElementById('file-tree');
  const info = document.getElementById('dir-info');
  const summary = document.getElementById('dir-summary');
  const btn = document.getElementById('upload-all-btn');

  container.innerHTML = '';

  const fileMap = {};
  files.forEach(f => {
    const parts = (f.webkitRelativePath || f.name).split('/');
    let current = fileMap;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = f;
  });

  function renderTree(node, depth) {
    const entries = Object.entries(node);
    entries.sort(([a], [b]) => {
      const aIsDir = typeof a === 'object';
      const bIsDir = typeof b === 'object';
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.localeCompare(b);
    });

    for (const [key, val] of entries) {
      if (val instanceof File) {
        const item = document.createElement('div');
        item.className = 'file-tree-item';
        item.style.paddingLeft = `${12 + depth * 16}px`;
        item.innerHTML = `
          <span class="ft-icon">📄</span>
          <span class="ft-path">${escapeHtml(key)}</span>
          <span class="ft-size">${formatSize(val.size)}</span>
        `;
        container.appendChild(item);
      } else {
        const item = document.createElement('div');
        item.className = 'file-tree-item file-tree-folder';
        item.style.paddingLeft = `${12 + depth * 16}px`;
        const count = countFiles(val);
        item.innerHTML = `
          <span class="ft-icon">📁</span>
          <span class="ft-path">${escapeHtml(key)}/</span>
          <span class="ft-size">${count} 文件</span>
        `;
        container.appendChild(item);
        renderTree(val, depth + 1);
      }
    }
  }

  function countFiles(node) {
    let c = 0;
    for (const v of Object.values(node)) {
      if (v instanceof File) c++;
      else c += countFiles(v);
    }
    return c;
  }

  renderTree(fileMap, 0);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  let summaryText = `${files.length} 个 .cas 文件，共 ${formatSize(totalSize)}`;
  if (skipped > 0) summaryText += `（已过滤 ${skipped} 个非 .cas 文件）`;
  summary.textContent = summaryText;

  info.style.display = 'block';
  btn.disabled = false;

  btn.onclick = () => startBatchUpload(files);

  const zipBtn = document.getElementById('zip-upload-btn');
  zipBtn.disabled = false;
  zipBtn.onclick = () => startZipUpload(files);
}

async function startBatchUpload(files) {
  const progress = document.getElementById('batch-progress');
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const results = document.getElementById('batch-results');
  const btn = document.getElementById('upload-all-btn');

  progress.style.display = 'block';
  results.innerHTML = '';
  btn.disabled = true;

  const BATCH_SIZE = 10;
  const BATCH_DELAY = 1000;
  let completed = 0;
  let successCount = 0;
  let failCount = 0;
  let failedFiles = [];

  const fileRows = files.map(file => {
    const item = document.createElement('div');
    item.className = 'batch-result-item';
    item.innerHTML = `
      <span class="br-icon">⏳</span>
      <span class="br-file">${escapeHtml(file.webkitRelativePath || file.name)}</span>
      <span class="br-msg">等待中…</span>
    `;
    results.appendChild(item);
    return item;
  });

  function updateProgress() {
    const pct = Math.round((completed / files.length) * 100);
    fill.style.width = pct + '%';
    text.textContent = `${completed}/${files.length} (成功 ${successCount}, 失败 ${failCount})`;
  }

  function setBatchStatus(startIdx, batchSize, icon, msg, className) {
    for (let j = 0; j < batchSize; j++) {
      const row = fileRows[startIdx + j];
      row.className = `batch-result-item ${className}`;
      row.querySelector('.br-icon').textContent = icon;
      row.querySelector('.br-msg').textContent = msg;
    }
  }

  for (let startIdx = 0; startIdx < files.length; startIdx += BATCH_SIZE) {
    const batch = files.slice(startIdx, startIdx + BATCH_SIZE);

    setBatchStatus(startIdx, batch.length, '⏳', '上传中…', '');

    try {
      const fd = new FormData();
      fd.append('count', batch.length);
      batch.forEach((file, i) => {
        fd.append(`file_${i}`, file, file.name);
        fd.append(`name_${i}`, file.name);
        fd.append(`path_${i}`, file.webkitRelativePath || file.name);
      });

      await apiRequest('/api/upload/batch', { method: 'POST', body: fd });
      setBatchStatus(startIdx, batch.length, '✅', '成功', 'success');
      successCount += batch.length;
    } catch (err) {
      setBatchStatus(startIdx, batch.length, '❌', err.message, 'error');
      failCount += batch.length;
      batch.forEach(f => failedFiles.push(f.webkitRelativePath || f.name));
    }

    completed += batch.length;
    updateProgress();

    if (startIdx + BATCH_SIZE < files.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  btn.disabled = false;
  await refreshStats();
  loadLeaderboard();

  if (failedFiles.length > 0) {
    text.textContent = `完成！${successCount} 成功，${failCount} 失败`;
    const detail = document.createElement('div');
    detail.className = 'alert alert-error';
    detail.style.marginTop = '8px';
    detail.innerHTML = `<strong>失败文件：</strong><br>${failedFiles.map(f => escapeHtml(f)).join('<br>')}`;
    results.appendChild(detail);
  } else {
    text.textContent = `全部完成！${successCount} 个文件上传成功 🎉`;
  }
}

async function startZipUpload(files) {
  const progress = document.getElementById('batch-progress');
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const results = document.getElementById('batch-results');
  const zipBtn = document.getElementById('zip-upload-btn');
  const batchBtn = document.getElementById('upload-all-btn');

  progress.style.display = 'block';
  results.innerHTML = '';
  zipBtn.disabled = true;
  batchBtn.disabled = true;

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  let totalCasSize = 0;
  const dirName = files[0]?.webkitRelativePath?.split('/')[0] || 'archive';
  const zipName = `${dirName}.zip`;

  const statusItem = document.createElement('div');
  statusItem.className = 'batch-result-item';
  statusItem.innerHTML = `
    <span class="br-icon">📦</span>
    <span class="br-file">正在压缩 ${files.length} 个文件…</span>
    <span class="br-msg">${formatSize(totalSize)}</span>
  `;
  results.appendChild(statusItem);

  await new Promise(r => setTimeout(r, 50));

  try {
    const zip = new JSZip();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = file.webkitRelativePath || file.name;
      const data = await file.arrayBuffer();
      const text = new TextDecoder().decode(data);
      try {
        const decoded = JSON.parse(atob(text));
        if (typeof decoded.size === 'number') totalCasSize += decoded.size;
      } catch (e) { /* skip malformed */ }
      zip.file(path, data);

      if (i % 10 === 0 || i === files.length - 1) {
        const pct = Math.round(((i + 1) / files.length) * 100);
        fill.style.width = pct + '%';
        text.textContent = `压缩中 ${i + 1}/${files.length} (${formatSize(totalSize)})`;
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    text.textContent = `压缩完成: ${formatSize(zipBlob.size)} (原始 ${formatSize(totalSize)})`;

    statusItem.querySelector('.br-icon').textContent = '📦';
    statusItem.querySelector('.br-file').textContent = zipName;
    statusItem.querySelector('.br-msg').textContent = `${formatSize(zipBlob.size)}`;

    const fd = new FormData();
    fd.append('file', zipBlob, zipName);
    fd.append('name', zipName);
    fd.append('path', dirName);
    fd.append('total_size', totalCasSize || totalSize);

    const uploadItem = document.createElement('div');
    uploadItem.className = 'batch-result-item';
    uploadItem.innerHTML = `
      <span class="br-icon">⏳</span>
      <span class="br-file">上传中…</span>
      <span class="br-msg"></span>
    `;
    results.appendChild(uploadItem);
    fill.style.width = '0%';
    text.textContent = '上传中…';

    await apiRequest('/api/upload/dir-zip', { method: 'POST', body: fd });

    uploadItem.className = 'batch-result-item success';
    uploadItem.querySelector('.br-icon').textContent = '✅';
    uploadItem.querySelector('.br-file').textContent = '上传成功';
    uploadItem.querySelector('.br-msg').textContent = `原始 ${formatSize(totalCasSize || totalSize)} → 压缩 ${formatSize(zipBlob.size)}`;
    fill.style.width = '100%';
    text.textContent = `上传成功！${zipName} (原始 ${formatSize(totalCasSize || totalSize)} → 压缩 ${formatSize(zipBlob.size)})`;
  } catch (err) {
    statusItem.className = 'batch-result-item error';
    statusItem.querySelector('.br-msg').textContent = err.message;
    text.textContent = '压缩上传失败';
  } finally {
    zipBtn.disabled = false;
    batchBtn.disabled = false;
    await refreshStats();
    loadLeaderboard();
  }
}

async function refreshStats() {
  try {
    const stats = await apiRequest('/api/user/stats');
    document.getElementById('upload-count').textContent = stats.user.upload_count;
    document.getElementById('total-size').textContent = formatSize(stats.user.total_size);
    renderUploadHistory(stats.uploads);
  } catch (err) {
    // silent
  }
}

function renderUploadHistory(uploads) {
  const tbody = document.getElementById('upload-history');
  tbody.innerHTML = '';

  if (uploads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">📄</span><p>暂无上传记录</p></div></td></tr>';
    return;
  }

  uploads.forEach((u, i) => {
    const tr = document.createElement('tr');
    tr.style.animation = `slideIn 0.25s ease both ${i * 0.05}s`;
    tr.innerHTML = `
      <td>${escapeHtml(u.file_name)}</td>
      <td>${formatSize(u.file_size)}</td>
      <td>${u.file_path ? escapeHtml(u.file_path) : '-'}</td>
      <td>${escapeHtml(u.caption) || '-'}</td>
      <td><span class="status-${u.status}">${u.status}</span></td>
      <td>${u.created_at}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showAlert(container, msg, type) {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = msg;
  container.prepend(alert);
  setTimeout(() => alert.remove(), type === 'success' ? 3000 : 5000);
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
