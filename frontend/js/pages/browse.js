import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';

function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function freshnessChip(item) {
  if (item.is_stale) {
    return '<span class="badge badge-computing"><span class="badge-dot"></span> Updating</span>';
  }
  return '<span class="badge badge-fresh"><span class="badge-dot"></span> Fresh</span>';
}

await requireAuth();
bindSidebar();

const ideaFilter = document.getElementById('idea-filter');
const sortFilter = document.getElementById('sort-filter');
const grid = document.querySelector('.match-grid');
const countEl = document.querySelector('.results-count');
const loadMoreBtn = document.getElementById('load-more-btn');
const mainContent = document.querySelector('.main-content');

const state = {
  ideas: [],
  selected: 'all',
  sort: 'score',
  cursors: new Map(),
  buckets: new Map(),
};

function showPageError(message) {
  const safe = esc(message || 'Unknown error');
  let alertEl = document.getElementById('browse-page-error');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'browse-page-error';
    alertEl.className = 'alert alert-error';
    mainContent?.prepend(alertEl);
  }
  alertEl.innerHTML = `<span>!</span><span>${safe}</span>`;
}

function clearPageError() {
  document.getElementById('browse-page-error')?.remove();
}

function render(items) {
  countEl.innerHTML = `Showing <strong>${items.length}</strong> matches`;

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">?</div>
        <div class="empty-title">No matches yet</div>
        <div class="empty-text">Your matches will appear once embeddings and scoring complete for the selected idea scope.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = items
    .map(
      (item) => `
        <article class="match-card slide-up">
          <div class="match-header">
            <div class="match-user">
              <div class="avatar">${esc((item.matched_idea.owner.name || 'U').charAt(0).toUpperCase())}</div>
              <div>
                <div class="match-name">${esc(item.matched_idea.owner.name)}</div>
                <div class="match-meta">${item.matched_idea.commitment_hrs || '-'}h / week</div>
              </div>
            </div>
            <div>
              <div class="score-kicker">Score</div>
              <div class="match-score">${Math.round((item.final_score || 0) * 100)}%</div>
            </div>
          </div>
          <p class="match-problem">${esc(item.matched_idea.problem)}</p>
          <div class="match-footer">
            <div class="match-tags">${freshnessChip(item)}</div>
            <div class="match-actions">
              <button class="btn btn-primary btn-sm" data-action="connect" data-match-id="${item.match_id}">Connect</button>
              <a class="btn btn-ghost btn-sm" href="#" title="Coming soon" data-action="view-placeholder">View</a>
            </div>
          </div>
        </article>
      `,
    )
    .join('');

  for (const button of grid.querySelectorAll('button[data-action="connect"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      clearPageError();
      try {
        await apiFetch('/feedback', {
          method: 'POST',
          body: { match_id: button.dataset.matchId, signal: 'connection_sent' },
        });
        button.textContent = 'Sent';
      } catch (error) {
        button.removeAttribute('disabled');
        showPageError(error.message || 'Failed to send request.');
      }
    });
  }

  for (const link of grid.querySelectorAll('[data-action="view-placeholder"]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
    });
  }
}

function aggregateAll() {
  const bestByUser = new Map();
  for (const ideaId of state.ideas.map((idea) => idea.id)) {
    for (const item of state.buckets.get(ideaId) || []) {
      const ownerId = item.matched_idea.owner.id;
      const existing = bestByUser.get(ownerId);
      if (!existing || item.final_score > existing.final_score) {
        bestByUser.set(ownerId, item);
      }
    }
  }
  return [...bestByUser.values()];
}

function sortItems(items) {
  if (state.sort === 'recent') {
    return items.sort((a, b) => new Date(b.computed_at || 0) - new Date(a.computed_at || 0));
  }
  return items.sort((a, b) => b.final_score - a.final_score);
}

async function fetchForIdea(ideaId, reset = false) {
  const cursor = reset ? null : state.cursors.get(ideaId) || null;
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);

  const response = await apiFetch(`/ideas/${ideaId}/matches?${query.toString()}`);
  const prev = reset ? [] : state.buckets.get(ideaId) || [];
  state.buckets.set(ideaId, [...prev, ...(response.items || [])]);
  state.cursors.set(ideaId, response.next_cursor || null);
}

async function refreshMatches(reset = true) {
  if (state.selected === 'all') {
    await Promise.all(state.ideas.map((idea) => fetchForIdea(idea.id, reset)));
    const merged = sortItems(aggregateAll());
    render(merged);
    const hasMore = state.ideas.some((idea) => state.cursors.get(idea.id));
    loadMoreBtn.hidden = !hasMore;
    return;
  }

  await fetchForIdea(state.selected, reset);
  const items = sortItems([...(state.buckets.get(state.selected) || [])]);
  render(items);
  loadMoreBtn.hidden = !state.cursors.get(state.selected);
}

async function init() {
  state.ideas = await apiFetch('/ideas/me');

  ideaFilter.innerHTML = `
    <option value="all">All ideas (best overall matches)</option>
    ${state.ideas.map((idea) => `<option value="${idea.id}">${esc(idea.problem)}</option>`).join('')}
  `;

  ideaFilter.addEventListener('change', async () => {
    clearPageError();
    state.selected = ideaFilter.value;
    await refreshMatches(true);
  });

  sortFilter.addEventListener('change', async () => {
    clearPageError();
    state.sort = sortFilter.value;
    await refreshMatches(false);
  });

  loadMoreBtn.addEventListener('click', async () => {
    clearPageError();
    await refreshMatches(false);
  });

  await refreshMatches(true);
}

try {
  clearPageError();
  await init();
} catch (error) {
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">!</div>
      <div class="empty-title">Unable to load matches</div>
      <div class="empty-text">${esc(error.message || 'Unknown error')}</div>
    </div>
  `;
  loadMoreBtn.hidden = true;
}
