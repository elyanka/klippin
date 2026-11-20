/**
 * Blog mockup (blog.html, article.html):
 *   - header: the menu panel (topics + the site's sections) and the search
 *     field that grows out of its icon button.
 *   - topic filter + search: chips with aria-pressed and the search text both
 *     narrow the post grid; posts that come back fade up (.is-entering).
 *     blog.html?topic=guides and ?q=… open filtered (the menu and the search
 *     on the article page link there).
 *   - reading progress: --read 0 → 1 on .read-progress as the article scrolls.
 *   - table of contents: the link of the section being read gets .is-active.
 * Each part returns early when its markup is missing.
 */

import { $, $$, on, prefersReducedMotion } from '../core/dom.js';

export function initBlog() {
  initMenu();
  const search = initSearch();
  initTopicFilter(search);
  initReadProgress();
  initToc();
}

/** Side panel menu: slides in under the header; the backdrop, Escape or a link close it. */
function initMenu() {
  const btn = $('[data-blog-menu-btn]');
  const menu = $('#blog-menu');
  const backdrop = $('[data-blog-menu-backdrop]');
  if (!btn || !menu) return;

  const isOpen = () => menu.classList.contains('is-open');
  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
    menu.inert = !open;
    if (open) $('a', menu)?.focus({ preventScroll: true });
  };
  on(btn, 'click', () => setOpen(!isOpen()));
  on(menu, 'click', (e) => { if (e.target.closest('a')) setOpen(false); });
  if (backdrop) on(backdrop, 'click', () => setOpen(false));
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); }
  });
}

/** Search field in the header. Returns { onInput, value, clear }, or null. */
function initSearch() {
  const form = $('[data-blog-search]');
  if (!form) return null;
  const input = $('input', form);
  const toggle = $('.blog-search__toggle', form);
  const onIndex = Boolean($('[data-post-topic]'));
  const listeners = new Set();

  const setOpen = (open) => {
    form.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close search' : 'Search posts');
    input.tabIndex = open ? 0 : -1;
    if (open) input.focus();
  };
  const clear = () => {
    input.value = '';
    listeners.forEach((fn) => fn(''));
  };

  on(toggle, 'click', () => {
    const open = !form.classList.contains('is-open');
    if (!open) clear();
    setOpen(open);
  });
  on(input, 'keydown', (e) => {
    if (e.key === 'Escape') { clear(); setOpen(false); toggle.focus(); }
  });
  on(input, 'input', () => listeners.forEach((fn) => fn(input.value)));
  // On the index the grid filters as you type; on an article Enter goes to the index.
  on(form, 'submit', (e) => { if (onIndex) e.preventDefault(); });

  const q = new URLSearchParams(location.search).get('q');
  if (q && onIndex) { input.value = q; setOpen(true); }

  return {
    onInput: (fn) => listeners.add(fn),
    value: () => input.value,
    clear: () => { clear(); setOpen(false); },
  };
}

/** Lower case, accents off, so "resume" finds "résumé". */
const norm = (text) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

function initTopicFilter(search) {
  const chips = $$('[data-topic]');
  const posts = $$('[data-post-topic]');
  const empty = $('[data-posts-empty]');
  const note = $('[data-posts-query]');
  if (!chips.length || !posts.length) return;

  // counts on the chips
  for (const chip of chips) {
    const t = chip.dataset.topic;
    const count = t === 'all' ? posts.length : posts.filter((p) => p.dataset.postTopic === t).length;
    const badge = $('.topic__count', chip);
    if (badge) badge.textContent = String(count);
  }

  let topic = 'all';
  let query = '';

  const render = () => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.topic === topic)));
    const q = norm(query.trim());
    let shown = 0;
    for (const post of posts) {
      const match = (topic === 'all' || post.dataset.postTopic === topic)
        && (!q || norm(post.textContent).includes(q));
      if (!match) { post.hidden = true; continue; }
      shown += 1;
      const wasHidden = post.hidden;
      post.hidden = false;
      // fade up the cards that come back (and all of them on a topic change)
      if ((wasHidden || !q) && !prefersReducedMotion()) {
        post.classList.remove('is-entering');
        void post.offsetWidth;
        post.style.animationDelay = `${(shown - 1) * 50}ms`;
        post.classList.add('is-entering');
      }
    }
    if (empty) empty.hidden = shown > 0;
    if (note) {
      note.hidden = !q;
      if (q) {
        const strong = document.createElement('strong');
        strong.textContent = `“${query.trim()}”`;
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Clear';
        on(reset, 'click', () => search?.clear());
        note.replaceChildren(`${shown} ${shown === 1 ? 'post' : 'posts'} for `, strong, reset);
      }
    }
  };

  for (const chip of chips) on(chip, 'click', () => { topic = chip.dataset.topic; render(); });
  // a post's tag is a link to its topic: on the index it filters in place
  for (const tag of $$('a.post-tag')) {
    on(tag, 'click', (e) => {
      const t = new URL(tag.href).searchParams.get('topic');
      if (!chips.some((c) => c.dataset.topic === t)) return;
      e.preventDefault();
      topic = t;
      render();
      $('#latest')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  }
  search?.onInput((value) => { query = value; render(); });

  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('topic');
  if (fromUrl && chips.some((c) => c.dataset.topic === fromUrl)) topic = fromUrl;
  query = search?.value() ?? '';
  if (topic !== 'all' || query) {
    render();
    $('#latest')?.scrollIntoView();
  }
}

function initReadProgress() {
  const bar = $('.read-progress');
  const article = $('[data-article]');
  if (!bar || !article) return;

  let queued = false;
  const update = () => {
    queued = false;
    const r = article.getBoundingClientRect();
    const total = r.height - innerHeight * 0.6;
    const read = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    bar.style.setProperty('--read', read.toFixed(4));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  on(globalThis, 'scroll', queue, { passive: true });
  on(globalThis, 'resize', queue);
  update();
}

function initToc() {
  const links = $$('.toc__link');
  if (!links.length) return;
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!sections.length) return;

  // the last heading above the upper third of the screen is the one being read
  let queued = false;
  const update = () => {
    queued = false;
    const line = innerHeight * 0.33;
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    links.forEach((a) => {
      const active = a.hash === `#${current.id}`;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  };
  on(globalThis, 'scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
