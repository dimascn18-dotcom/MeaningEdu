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

  let scheduled = false;
  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renderMath(document.body);
    });
  }

  scope.MeaningEduMath = Object.freeze({ render: renderMath });
  document.addEventListener('DOMContentLoaded', () => {
    renderMath(document.body);
    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})(window);
