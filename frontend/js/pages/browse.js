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

function safeExternalUrl(value) {
  const normalized = String(value || '').trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }
  return normalized;
}

await requireAuth();
bindSidebar();

const ideaFilter = document.getElementById('idea-filter');
const sortFilter = document.getElementById('sort-filter');
const grid = document.querySelector('.match-grid');
const countEl = document.querySelector('.results-count');
const loadMoreBtn = document.getElementById('load-more-btn');

const state = {
  ideas: [],
  selected: 'all',
  sort: 'score',
  cursors: new Map(),
  buckets: new Map(),
};

function render(items) {
  countEl.innerHTML = `Showing <strong>${items.length}</strong> matches`;

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1 / -1">
        <div class="empty-icon">🔎</div>
        <div class="empty-title">No matches yet</div>
        <div class="empty-text">Your matches will appear once embeddings and scoring complete.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const ownerName = item?.matched_idea?.owner?.name || 'Unknown User';
      const ownerInitial = ownerName.charAt(0).toUpperCase() || 'U';
      const githubUrl = safeExternalUrl(item?.matched_idea?.owner?.github_url);

      const profileAction = githubUrl
        ? `<a class="btn btn-ghost btn-sm" href="${esc(githubUrl)}" target="_blank" rel="noreferrer noopener">GitHub</a>`
        : '<button class="btn btn-ghost btn-sm" type="button" disabled title="No public profile linked">Profile N/A</button>';

      return `
      <div class="match-card slide-up">
        <div class="match-header">
          <div class="match-user">
            <div class="avatar">${esc(ownerInitial)}</div>
            <div>
              <div class="match-name">${esc(ownerName)}</div>
              <div class="match-meta">${item?.matched_idea?.commitment_hrs || '—'}h / week</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Score</div>
            <div class="match-score">${Math.round((item.final_score || 0) * 100)}%</div>
          </div>
        </div>
        <p class="match-problem">${esc(item?.matched_idea?.problem || 'No problem statement available.')}</p>
        <div class="match-footer">
          <div class="match-tags">
            <span class="tag-chip">${item.is_stale ? 'Updating' : 'Fresh'}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary btn-sm" data-action="connect" data-match-id="${item.match_id}">Connect</button>
            ${profileAction}
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  for (const button of grid.querySelectorAll('button[data-action="connect"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await apiFetch('/feedback', {
          method: 'POST',
          body: { match_id: button.dataset.matchId, signal: 'connection_sent' },
        });
        button.textContent = 'Sent';
      } catch (error) {
        button.removeAttribute('disabled');
        alert(error.message || 'Failed to send request.');
      }
    });
  }
}

function aggregateAll() {
  const bestByUser = new Map();
  for (const ideaId of state.ideas.map((idea) => idea.id)) {
    for (const item of state.buckets.get(ideaId) || []) {
      const ownerId = item?.matched_idea?.owner?.id;
      if (!ownerId) continue;
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

function renderCurrentSelection() {
  if (state.selected === 'all') {
    render(sortItems(aggregateAll()));
    return;
  }

  render(sortItems([...(state.buckets.get(state.selected) || [])]));
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
    for (const idea of state.ideas) {
      await fetchForIdea(idea.id, reset);
    }
    renderCurrentSelection();
    const hasMore = state.ideas.some((idea) => state.cursors.get(idea.id));
    loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    return;
  }

  await fetchForIdea(state.selected, reset);
  renderCurrentSelection();
  loadMoreBtn.style.display = state.cursors.get(state.selected) ? 'inline-flex' : 'none';
}

async function init() {
  state.ideas = await apiFetch('/ideas/me');

  ideaFilter.innerHTML = `
    <option value="all">All Ideas (aggregated)</option>
    ${state.ideas.map((idea) => `<option value="${idea.id}">${esc(idea.problem)}</option>`).join('')}
  `;

  ideaFilter.addEventListener('change', async () => {
    state.selected = ideaFilter.value;
    await refreshMatches(true);
  });

  sortFilter.addEventListener('change', () => {
    state.sort = sortFilter.value;
    renderCurrentSelection();
  });

  loadMoreBtn.addEventListener('click', async () => {
    await refreshMatches(false);
  });

  if (!state.ideas.length) {
    render([]);
    loadMoreBtn.style.display = 'none';
    return;
  }

  await refreshMatches(true);
}

try {
  await init();
} catch (error) {
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1 / -1">
      <div class="empty-icon">!</div>
      <div class="empty-title">Unable to load matches</div>
      <div class="empty-text">${esc(error.message || 'Unknown error')}</div>
    </div>
  `;
}