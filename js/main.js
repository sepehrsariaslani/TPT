/* nav, reveal, counters, form */
(function () {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const links = document.querySelector('.nav__links');

  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  burger?.addEventListener('click', () => links.classList.toggle('open'));
  links?.addEventListener('click', e => { if (e.target.tagName === 'A') links.classList.remove('open'); });

  /* reveal on scroll */
  const targets = document.querySelectorAll('.head, .card, .capacity__text, .capacity__specs, .ind, .gal__item, .steps li, .faq details, .contact__grid > *');
  targets.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 6) * 60 + 'ms'; });
  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .15 });
  targets.forEach(el => io.observe(el));

  /* counters */
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const nums = document.querySelectorAll('[data-count]');
  const io2 = new IntersectionObserver((es) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || '';
      const t0 = performance.now(), dur = 1400;
      const tick = t => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = fa(Math.round(end * (1 - Math.pow(1 - k, 3)))) + suf;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io2.unobserve(el);
    });
  }, { threshold: .6 });
  nums.forEach(n => io2.observe(n));

  /* form */
  const form = document.getElementById('quoteForm');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.name.value.trim(), phone = form.phone.value.trim();
    if (!name || !phone) { alert('لطفاً نام و شماره تماس را وارد کنید.'); return; }
    document.getElementById('formNote').hidden = false;
    form.reset();
  });
})();
