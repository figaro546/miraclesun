(() => {
  document.querySelectorAll('[data-lead-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('.form-status');
      const button = form.querySelector('button[type="submit"]');
      const payload = Object.fromEntries(new FormData(form));
      payload.source = form.dataset.source;
      payload.action = form.dataset.action;
      payload.pageUrl = location.href;
      payload.pageTitle = document.title;
      button.disabled = true; status.textContent = 'Sending…';
      try {
        const response = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to submit');
        form.reset(); status.textContent = 'Thank you. We received your request.';
      } catch (error) { status.textContent = 'Something went wrong. Please email us directly.'; }
      finally { button.disabled = false; }
    });
  });
})();
