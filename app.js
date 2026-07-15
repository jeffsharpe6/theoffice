const state = {
  episodes: [], search: '', season: 'all', character: 'all', sort: 'episode-asc',
  joke: 'all', favoritesOnly: false, visible: 24,
  favorites: new Set(JSON.parse(localStorage.getItem('office-favorites') || '[]')),
};

const $ = (selector) => document.querySelector(selector);
const els = {
  grid: $('#episode-grid'), template: $('#episode-template'), search: $('#search'),
  season: $('#season-filter'), character: $('#character-filter'), sort: $('#sort-select'),
  summary: $('#results-summary'), loadMore: $('#load-more'), empty: $('#empty-state'),
  favoritesToggle: $('#favorites-toggle'), favoriteCount: $('#favorite-count'),
  activeFilters: $('#active-filters'), theme: $('#theme-toggle'),
};

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function saveFavorites() {
  localStorage.setItem('office-favorites', JSON.stringify([...state.favorites]));
  els.favoriteCount.textContent = state.favorites.size;
}

function filteredEpisodes() {
  const needle = state.search.trim().toLowerCase();
  const items = state.episodes.filter(ep => {
    const searchable = [ep.title, ep.summary, ...ep.characters].join(' ').toLowerCase();
    return (!needle || searchable.includes(needle))
      && (state.season === 'all' || ep.season === Number(state.season))
      && (state.character === 'all' || ep.characters.includes(state.character))
      && (state.joke === 'all' || ep.jokes[state.joke] > 0)
      && (!state.favoritesOnly || state.favorites.has(ep.id));
  });
  const sorters = {
    'episode-asc': (a,b) => a.absolute - b.absolute,
    'rating-desc': (a,b) => b.rating - a.rating || a.absolute - b.absolute,
    'rating-asc': (a,b) => a.rating - b.rating || a.absolute - b.absolute,
    'date-asc': (a,b) => a.airDate.localeCompare(b.airDate) || a.absolute - b.absolute,
    'date-desc': (a,b) => b.airDate.localeCompare(a.airDate) || b.absolute - a.absolute,
  };
  return items.sort(sorters[state.sort]);
}

function renderCard(ep) {
  const card = els.template.content.firstElementChild.cloneNode(true);
  const img = card.querySelector('.card-image');
  img.src = ep.image;
  img.alt = `Scene from “${ep.title}”`;
  img.addEventListener('error', () => { img.closest('.card-image-wrap').classList.add('image-missing'); img.remove(); }, {once:true});
  card.querySelector('.episode-code').textContent = `S${String(ep.season).padStart(2,'0')} · E${String(ep.episode).padStart(2,'0')}`;
  card.querySelector('.rating span').textContent = ep.rating.toFixed(1);
  const title = card.querySelector('.episode-title');
  title.textContent = ep.title; title.href = ep.peacock; title.title = `Search Peacock for ${ep.title}`;
  card.querySelector('.air-date').textContent = dateFormat.format(new Date(`${ep.airDate}T12:00:00`));
  const summary = card.querySelector('.summary');
  summary.textContent = ep.summary || 'Episode summary is unavailable.';
  const summaryToggle = card.querySelector('.summary-toggle');
  summaryToggle.addEventListener('click', () => {
    const expanded = summaryToggle.getAttribute('aria-expanded') === 'true';
    summaryToggle.setAttribute('aria-expanded', String(!expanded));
    summaryToggle.textContent = expanded ? 'Read full summary' : 'Show less';
    summary.classList.toggle('expanded', !expanded);
  });
  const characters = card.querySelector('.characters');
  ep.characters.slice(0, 5).forEach(name => characters.insertAdjacentHTML('beforeend', `<span>${escapeHtml(name)}</span>`));
  if (ep.characters.length > 5) characters.insertAdjacentHTML('beforeend', `<span>+${ep.characters.length - 5}</span>`);
  const jokeLabels = {twss:'TWSS', dundies:'Dundies', pranks:'Pranks'};
  const jokeBadges = card.querySelector('.joke-badges');
  Object.entries(ep.jokes).filter(([,count]) => count > 0).forEach(([key,count]) => jokeBadges.insertAdjacentHTML('beforeend', `<span>${jokeLabels[key]} × ${count}</span>`));
  if (!jokeBadges.children.length) jokeBadges.remove();
  const watch = card.querySelector('.watch-link'); watch.href = ep.peacock;
  const favorite = card.querySelector('.favorite-button');
  favorite.dataset.id = ep.id;
  favorite.setAttribute('aria-pressed', state.favorites.has(ep.id));
  favorite.setAttribute('aria-label', `${state.favorites.has(ep.id) ? 'Remove' : 'Add'} “${ep.title}” ${state.favorites.has(ep.id) ? 'from' : 'to'} favorites`);
  favorite.addEventListener('click', () => toggleFavorite(ep.id));
  return card;
}

function render() {
  const filtered = filteredEpisodes();
  const shown = filtered.slice(0, state.visible);
  els.grid.replaceChildren(...shown.map(renderCard));
  requestAnimationFrame(syncSummaryControls);
  els.summary.textContent = `${filtered.length} ${filtered.length === 1 ? 'episode' : 'episodes'} found`;
  els.empty.hidden = filtered.length > 0;
  els.loadMore.hidden = shown.length >= filtered.length;
  els.loadMore.textContent = `Load more (${filtered.length - shown.length} remaining)`;
  els.favoritesToggle.setAttribute('aria-pressed', state.favoritesOnly);
  els.favoritesToggle.classList.toggle('active', state.favoritesOnly);
  renderActiveFilters();
}

function syncSummaryControls() {
  els.grid.querySelectorAll('.episode-card').forEach(card => {
    const summary = card.querySelector('.summary');
    const toggle = card.querySelector('.summary-toggle');
    if (summary.classList.contains('expanded')) return;
    const clipped = summary.scrollHeight > summary.clientHeight + 1;
    toggle.hidden = !clipped;
  });
}

function renderActiveFilters() {
  const filters = [];
  if (state.search) filters.push(['search', `Search: ${state.search}`]);
  if (state.season !== 'all') filters.push(['season', `Season ${state.season}`]);
  if (state.character !== 'all') filters.push(['character', state.character]);
  if (state.joke !== 'all') filters.push(['joke', {twss:'That’s what she said', dundies:'Dundies', pranks:'Pranks'}[state.joke]]);
  if (state.favoritesOnly) filters.push(['favorites', 'Favorites']);
  els.activeFilters.innerHTML = filters.map(([key,label]) => `<button type="button" data-clear="${key}" aria-label="Remove ${escapeHtml(label)} filter">${escapeHtml(label)} ×</button>`).join('');
}

function toggleFavorite(id) {
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  saveFavorites(); render();
}

function resetVisibleAndRender() { state.visible = 24; render(); }
function clearAll() {
  Object.assign(state, {search:'', season:'all', character:'all', joke:'all', favoritesOnly:false, visible:24});
  els.search.value = ''; els.season.value = 'all'; els.character.value = 'all';
  document.querySelectorAll('[data-joke]').forEach(b => { b.classList.toggle('active', b.dataset.joke === 'all'); b.setAttribute('aria-pressed', b.dataset.joke === 'all'); });
  render();
}

function wireEvents() {
  els.search.addEventListener('input', e => { state.search = e.target.value; resetVisibleAndRender(); });
  els.season.addEventListener('change', e => { state.season = e.target.value; resetVisibleAndRender(); });
  els.character.addEventListener('change', e => { state.character = e.target.value; resetVisibleAndRender(); });
  els.sort.addEventListener('change', e => { state.sort = e.target.value; resetVisibleAndRender(); });
  document.querySelectorAll('[data-joke]').forEach(button => button.addEventListener('click', () => setJoke(button.dataset.joke)));
  document.querySelectorAll('[data-ledger-joke]').forEach(button => button.addEventListener('click', () => { setJoke(button.dataset.ledgerJoke); $('#explorer-title').scrollIntoView({behavior:'smooth'}); }));
  els.loadMore.addEventListener('click', () => { state.visible += 24; render(); });
  els.favoritesToggle.addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; resetVisibleAndRender(); });
  $('#clear-filters').addEventListener('click', clearAll);
  els.activeFilters.addEventListener('click', e => {
    const key = e.target.dataset.clear; if (!key) return;
    if (key === 'search') { state.search = ''; els.search.value = ''; }
    if (key === 'season') { state.season = 'all'; els.season.value = 'all'; }
    if (key === 'character') { state.character = 'all'; els.character.value = 'all'; }
    if (key === 'joke') setJoke('all');
    if (key === 'favorites') state.favoritesOnly = false;
    resetVisibleAndRender();
  });
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); els.search.focus(); } });
  els.theme.addEventListener('click', toggleTheme);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncSummaryControls, 120);
  });
}

function setJoke(joke) {
  state.joke = joke;
  document.querySelectorAll('[data-joke]').forEach(b => { const active = b.dataset.joke === joke; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
  resetVisibleAndRender();
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('office-theme', next);
  els.theme.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]').content = next === 'dark' ? '#121715' : '#f4efe5';
}

async function init() {
  const theme = localStorage.getItem('office-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  const response = await fetch('data/episodes.json');
  if (!response.ok) throw new Error('Could not load episode data.');
  state.episodes = await response.json();
  for (let i=1; i<=9; i++) els.season.insertAdjacentHTML('beforeend', `<option value="${i}">Season ${i}</option>`);
  const characterCounts = new Map();
  state.episodes.flatMap(e => e.characters).forEach(name => characterCounts.set(name, (characterCounts.get(name)||0)+1));
  [...characterCounts].filter(([,count]) => count >= 5).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).forEach(([name]) => els.character.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`));
  const totals = key => state.episodes.reduce((sum, ep) => sum + ep.jokes[key], 0);
  $('#twss-total').textContent = totals('twss'); $('#dundies-total').textContent = totals('dundies'); $('#pranks-total').textContent = totals('pranks');
  saveFavorites(); wireEvents(); render();
}

init().catch(error => { els.summary.textContent = error.message; els.empty.hidden = false; });
