function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  const apiKey = localStorage.getItem('api_key');

  if (!apiKey) {
    window.location.href = '/';
    return;
  }

  try {
    const stats = await apiRequest('/api/user/stats');
    if (!stats.user.is_admin) {
      window.location.href = '/dashboard';
      return;
    }
  } catch {
    window.location.href = '/';
    return;
  }

  document.getElementById('create-tag-btn').addEventListener('click', createTag);
  document.getElementById('tag-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createTag();
  });

  await loadTags();
});

async function loadTags() {
  const data = await apiRequest('/api/admin/tags');
  const tbody = document.getElementById('tags-list');
  tbody.innerHTML = '';

  if (data.tags.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><span class="empty-icon">🏷️</span><p>暂无标签</p></div></td></tr>';
    return;
  }

  data.tags.forEach((tag, i) => {
    const tr = document.createElement('tr');
    tr.style.animation = `slideIn 0.2s ease both ${i * 0.04}s`;
    tr.innerHTML = `
      <td><span class="status-success" style="display:inline-block;padding:2px 10px;border-radius:var(--radius-xs);background:var(--accent-soft);color:var(--accent);font-size:13px;">${escapeHtml(tag.name)}</span></td>
      <td>${tag.upload_count}</td>
      <td>${tag.created_at}</td>
      <td><button class="btn-sm" data-tag-id="${tag.id}" data-tag-name="${escapeHtml(tag.name)}">删除</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-tag-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteTag(parseInt(btn.dataset.tagId), btn.dataset.tagName);
    });
  });
}

async function createTag() {
  const input = document.getElementById('tag-name');
  const name = input.value.trim();
  if (!name) return;

  const btn = document.getElementById('create-tag-btn');
  btn.disabled = true;
  btn.textContent = '创建中…';

  try {
    await apiRequest('/api/admin/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    input.value = '';
    await loadTags();
  } catch (err) {
    alert('创建失败：' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '创建';
  }
}

async function deleteTag(id, name) {
  if (!confirm(`确定要删除标签 "${name}" 吗？将从所有关联上传中移除。`)) return;

  try {
    await apiRequest(`/api/admin/tags?id=${id}`, { method: 'DELETE' });
    await loadTags();
  } catch (err) {
    alert('删除失败：' + err.message);
  }
}
