class UrlManager {
  constructor() {
    this.currentEditId = null;
    this.urls = [];
    this.currentTabUrl = null;
    this.init();
  }

  async init() {
    await this.loadUrls();
    await this.getCurrentTab();
    this.setupEvents();
    this.render();
  }

  async loadUrls() {
    const data = await chrome.storage.local.get(['urls']);
    this.urls = (data.urls || []).map((u, i) => ({
      ...u,
      id: u.id || `id_${i}_${Date.now()}`
    }));
  }

  async saveUrls() {
    await chrome.storage.local.set({ urls: this.urls });
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTabUrl = tab?.url ? this.normalize(tab.url) : null;
    } catch (e) {
      this.currentTabUrl = null;
    }
  }

  setupEvents() {
    document.getElementById('addBtn').onclick = () => this.addUrl();
    document.getElementById('saveBtn').onclick = () => this.saveEdit();
    document.getElementById('clearBtn').onclick = () => this.clearForm();
    document.getElementById('exportBtn').onclick = () => this.exportUrls();
    document.getElementById('importFile').onchange = (e) => this.importUrls(e);
    document.getElementById('searchInput').oninput = (e) => this.filter(e.target.value);

    ['urlTitle', 'urlLink'].forEach(id => {
      document.getElementById(id).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addUrl();
      });
    });
  }

  render(filtered = null) {
    const list = document.getElementById('urlList');
    const items = filtered || this.urls;

    if (!items.length) {
      list.innerHTML = '<div class="no-urls">Nenhuma URL salva</div>';
      return;
    }

    list.innerHTML = items.map((url, idx) => {
      const isCurrent = this.currentTabUrl && this.normalize(url.link) === this.currentTabUrl;
      return `
        <div class="url-item ${isCurrent ? 'current-url' : ''}" data-id="${url.id}">
          <div class="url-info">
            <div class="url-title">${this.escape(url.title)}</div>
            <div class="url-link">${this.escape(url.link)}</div>
          </div>
          <div class="url-actions">
            <button class="btn-primary edit-btn">Editar</button>
            <button class="btn-danger delete-btn">Deletar</button>
            <button class="btn-success open-btn">Abrir</button>
          </div>
        </div>`;
    }).join('');

    // Reatribuir eventos (DOM recriado)
    this.setupActionButtons();
  }

  setupActionButtons() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.onclick = (e) => {
        const item = e.target.closest('.url-item');
        const id = item.dataset.id;
        const idx = this.urls.findIndex(u => u.id === id);
        if (idx !== -1) this.edit(idx);
      };
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        const item = e.target.closest('.url-item');
        const id = item.dataset.id;
        const idx = this.urls.findIndex(u => u.id === id);
        if (idx !== -1 && confirm('Deletar esta URL?')) {
          this.remove(idx);
        }
      };
    });

    document.querySelectorAll('.open-btn').forEach(btn => {
      btn.onclick = (e) => {
        const item = e.target.closest('.url-item');
        const id = item.dataset.id;
        const idx = this.urls.findIndex(u => u.id === id);
        if (idx !== -1) this.open(idx);
      };
    });
  }

  filter(term) {
    const lower = term.toLowerCase();
    const filtered = this.urls.filter(u =>
      u.title.toLowerCase().includes(lower) || u.link.toLowerCase().includes(lower)
    );
    this.render(filtered);
  }

  async addUrl() {
    const title = document.getElementById('urlTitle').value.trim();
    const link = this.normalize(document.getElementById('urlLink').value.trim());

    if (!title || !link) return this.notify('Preencha título e URL');
    if (!this.isValidUrl(link)) return this.notify('URL inválida');

    this.urls.unshift({
      id: `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      link,
      createdAt: new Date().toISOString()
    });

    await this.saveUrls();
    this.render();
    this.clearForm();
    this.notify('URL adicionada!');
  }

  edit(idx) {
    const url = this.urls[idx];
    document.getElementById('urlTitle').value = url.title;
    document.getElementById('urlLink').value = url.link;
    this.currentEditId = url.id;

    document.getElementById('addBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('urlTitle').focus();
  }

  async saveEdit() {
    if (!this.currentEditId) return;

    const title = document.getElementById('urlTitle').value.trim();
    const link = this.normalize(document.getElementById('urlLink').value.trim());

    if (!title || !link) return this.notify('Preencha título e URL');
    if (!this.isValidUrl(link)) return this.notify('URL inválida');

    const idx = this.urls.findIndex(u => u.id === this.currentEditId);
    if (idx > -1) {
      this.urls[idx] = {
        ...this.urls[idx],
        title,
        link,
        updatedAt: new Date().toISOString()
      };
      await this.saveUrls();
      this.render();
      this.clearForm();
      this.notify('URL atualizada!');
    }
  }

  async remove(idx) {
    this.urls.splice(idx, 1);
    await this.saveUrls();
    this.render();
    this.notify('URL removida');
  }

  open(idx) {
    chrome.tabs.create({ url: this.urls[idx].link });
    window.close();
  }

  clearForm() {
    document.getElementById('urlTitle').value = '';
    document.getElementById('urlLink').value = '';
    document.getElementById('searchInput').value = '';
    this.currentEditId = null;
    document.getElementById('addBtn').style.display = 'inline-block';
    document.getElementById('saveBtn').style.display = 'none';
    this.render();
  }

  // EXPORT / IMPORT
  exportUrls() {
    if (!this.urls.length) return this.notify('Nenhuma URL para exportar');
    const text = this.urls.map(u => `${u.title}\n${u.link}\n---`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urls_export_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify('URLs exportadas!');
  }

  importUrls(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\n/).map(l => l.trim()).filter(Boolean);
      const imported = [];
      for (let i = 0; i < lines.length; i += 3) {
        if (lines[i+1] && this.isValidUrl(lines[i+1])) {
          imported.push({
            id: `imp_${Date.now()}_${i}`,
            title: lines[i] || 'Sem título',
            link: this.normalize(lines[i+1]),
            createdAt: new Date().toISOString()
          });
        }
      }
      this.urls = [...imported, ...this.urls];
      this.saveUrls().then(() => {
        this.render();
        this.notify(`${imported.length} URLs importadas!`);
      });
    };
    reader.readAsText(file);
  }

  // UTILS
  isValidUrl(str) { try { new URL(str); return true; } catch { return false; } }
  normalize(url) { try { return new URL(url).href; } catch { return url; } }
  escape(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

  notify(msg) {
    const n = document.createElement('div');
    n.className = 'notification';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }
}

// INICIAR
const app = new UrlManager();
window.app = app; // Para depuração (opcional)