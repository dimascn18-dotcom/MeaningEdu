(function setupMeaningEduMath(scope) {
  const options = Object.freeze({
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false,
    trust: false,
    strict: 'warn',
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    ignoredClasses: ['katex', 'no-math-render']
  });
  function renderMath(root = document.body) {
    if (!root || typeof scope.renderMathInElement !== 'function') return;
    scope.renderMathInElement(root, options);
  }
  scope.MeaningEduMath = Object.freeze({ render: renderMath });
  document.addEventListener('DOMContentLoaded', () => {
    renderMath(document.body);
    const roots = new Set();
    let scheduled = false;
    const ignored = 'script,style,textarea,pre,code,.katex,.no-math-render';
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const root = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        if (!(root instanceof Element) || root.closest(ignored)) continue;
        if (!/\\[([]/.test(root.textContent)) continue;
        roots.add(root);
      }
      if (!roots.size || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const pending = [...roots]; roots.clear();
        // Rendering inserts KaTeX nodes; don't observe our own changes.
        observer.disconnect();
        for (const root of pending) {
          if (root.isConnected && !pending.some(other => other !== root && other.contains(root))) renderMath(root);
        }
        observe();
      });
    });
    function observe() { observer.observe(document.body, { childList:true, subtree:true, characterData:true }); }
    observe();
  });
})(window);
