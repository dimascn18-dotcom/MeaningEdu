/* Small shared interaction layer; no pedagogical calculations or API writes. */
(function () {
  function showError(root, message, retry) {
    root.replaceChildren();
    const box = document.createElement('div');
    box.className = 'ui-error'; box.setAttribute('role', 'alert');
    const text = document.createElement('p'); text.textContent = message;
    box.append(text);
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Coba lagi';
      button.addEventListener('click', retry); box.append(button);
    }
    root.append(box);
  }
  function notice(root, message, kind = 'error') {
    root.textContent = message;
    root.className = `form-status ${kind === 'success' ? 'status-success' : 'status-error'}`;
    root.setAttribute('role', kind === 'success' ? 'status' : 'alert');
  }
  window.MeaningEduUI = Object.freeze({ showError, notice });
  function enhance(root) {
    if (!(root instanceof Element)) return;
    const elements = [root, ...root.querySelectorAll('.aktivitas-chip,.kelas-item,.jalur-tab,.incl-btn,.loading-state,.empty-hint,.step-dot')];
    for (const el of elements) {
      if (el.matches('.aktivitas-chip,.kelas-item,.jalur-tab,#btnDisleksia')) {
        const pressed = String(el.classList.contains('active'));
        if (el.getAttribute('aria-pressed') !== pressed) el.setAttribute('aria-pressed', pressed);
      }
      if (el.matches('.loading-state,.empty-hint') && /Memuat/.test(el.textContent)) el.setAttribute('role', 'status');
      if (el.matches('.step-dot')) el.setAttribute('aria-label', `Tahap refleksi ${el.textContent}`);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    enhance(document.body);
    new MutationObserver(records => records.forEach(r => {
      if (r.type === 'attributes') enhance(r.target);
      else r.addedNodes.forEach(enhance);
    })).observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    const main = document.querySelector('main');
    if (main && /dashboard-guru|workspace-siswa/.test(location.pathname)) {
      const connection = document.createElement('p');
      connection.className = 'connection-status'; connection.setAttribute('role','status');
      const update = () => { connection.textContent = navigator.onLine
        ? 'Online · AI dan PDF memerlukan koneksi internet.'
        : 'Luring · Materi yang sudah terbuka dapat dibaca. Jurnal akhir dapat diantrekan; AI dan PDF tidak tersedia.'; };
      main.prepend(connection); update();
      addEventListener('online', update); addEventListener('offline', update);
    }
  });
})();
