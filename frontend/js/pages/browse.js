import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { bindTopbarProfile } from '../topbar.js';

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

const session = await requireAuth();
bindSidebar();
bindTopbarProfile(session);

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
  meta: new Map(),
  pollTimer: null,
  pollAttempts: 0,
  maxPollAttempts: 20,
  pipelineTriggered: false,
  pipelineTriggerError: null,
  refreshing: false,
};

function selectedIdeaIds() {
  return state.selected === 'all' ? state.ideas.map((idea) => idea.id) : [state.selected];
}

function selectedMeta() {
  return selectedIdeaIds()
    .map((ideaId) => state.meta.get(ideaId))
    .filter(Boolean);
}

function clearPolling() {
  if (state.pollTimer) {
    window.clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
}

function setSummary(text) {
  countEl.innerHTML = text;
}

function emptyState({ icon, title, text, actionHref = null, actionLabel = null, actionId = null }) {
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1 / -1">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-text">${text}</div>
      ${actionHref && actionLabel ? `<a href="${actionHref}" class="btn btn-primary btn-sm">${actionLabel}</a>` : ''}
      ${!actionHref && actionLabel ? `<button type="button" class="btn btn-primary btn-sm" id="${actionId || 'empty-state-action'}">${actionLabel}</button>` : ''}
    </div>
  `;
}

async function retryPipeline() {
  state.pollAttempts = 0;
  state.pipelineTriggered = false;
  state.pipelineTriggerError = null;
  clearPolling();
  await refreshMatches(true);
}

function render(items) {
  if (items.length) {
    setSummary(`Showing <strong>${items.length}</strong> matches`);
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
    return;
  }

  const meta = selectedMeta();
  const anyComputing = meta.some((item) => item.freshness === 'computing');
  const allNeedInput = meta.length > 0 && meta.every((item) => item.freshness === 'needs_input');

  if (anyComputing) {
    const timedOut = state.pollAttempts >= state.maxPollAttempts;
    const suffix = state.pipelineTriggerError
      ? ` ${esc(state.pipelineTriggerError)}`
      : timedOut
        ? ' Matching is taking longer than expected.'
        : ' We are refreshing recommendations automatically.';
    setSummary('Preparing recommendations');
    emptyState({
      icon: '⌛',
      title: 'Recommendations are still computing',
      text: `Your similar ideas are being embedded and rescored.${suffix}`,
      actionLabel: timedOut || state.pipelineTriggerError ? 'Retry now' : null,
      actionId: 'retry-pipeline-btn',
    });

    const retryBtn = document.getElementById('retry-pipeline-btn');
    retryBtn?.addEventListener('click', async () => {
      retryBtn.setAttribute('disabled', 'disabled');
      await retryPipeline();
    });
    return;
  }

  if (allNeedInput) {
    const href = state.selected === 'all' ? '/ideas.html' : `/idea-editor.html?id=${state.selected}`;
    setSummary('Idea needs revision before matching');
    emptyState({
      icon: '✏️',
      title: 'Finish your idea details first',
      text: 'This idea still needs a valid canonical summary before recommendations can be generated.',
      actionHref: href,
      actionLabel: state.selected === 'all' ? 'Review My Ideas' : 'Edit Idea',
    });
    return;
  }

  setSummary('Showing <strong>0</strong> matches');
  emptyState({
    icon: '🔎',
    title: 'No matches yet',
    text: 'We checked your current recommendations and did not find any compatible teammates yet.',
  });
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

async function triggerPipelineOnce() {
  if (state.pipelineTriggered) return;
  state.pipelineTriggered = true;
  try {
    await apiFetch('/pipeline/run', { method: 'POST' });
  } catch (error) {
    state.pipelineTriggerError = error.message || 'Automatic refresh could not be started.';
  }
}

async function fetchForIdea(ideaId, reset = false) {
  const cursor = reset ? null : state.cursors.get(ideaId) || null;
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);

  const response = await apiFetch(`/ideas/${ideaId}/matches?${query.toString()}`);
  const prev = reset ? [] : state.buckets.get(ideaId) || [];
  state.buckets.set(ideaId, [...prev, ...(response.items || [])]);
  state.cursors.set(ideaId, response.next_cursor || null);
  state.meta.set(ideaId, {
    freshness: response.freshness || 'partial',
    total: Number(response.total || 0),
  });
}

function updateLoadMoreVisibility() {
  if (state.selected === 'all') {
    const hasMore = state.ideas.some((idea) => state.cursors.get(idea.id));
    loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    return;
  }

  loadMoreBtn.style.display = state.cursors.get(state.selected) ? 'inline-flex' : 'none';
}

function schedulePollingIfNeeded() {
  clearPolling();

  if (!selectedMeta().some((item) => item.freshness === 'computing')) {
    return;
  }

  if (state.pollAttempts >= state.maxPollAttempts) {
    renderCurrentSelection();
    return;
  }

  state.pollTimer = window.setTimeout(async () => {
    state.pollTimer = null;
    state.pollAttempts += 1;
    await refreshMatches(true);
  }, 2500);
}

async function refreshMatches(reset = true) {
  if (state.refreshing) return;
  state.refreshing = true;

  try {
    if (state.selected === 'all') {
      for (const idea of state.ideas) {
        await fetchForIdea(idea.id, reset);
      }
    } else {
      await fetchForIdea(state.selected, reset);
    }

    renderCurrentSelection();
    updateLoadMoreVisibility();

    if (selectedMeta().some((item) => item.freshness === 'computing')) {
      await triggerPipelineOnce();
      renderCurrentSelection();
      schedulePollingIfNeeded();
    } else {
      clearPolling();
    }
  } finally {
    state.refreshing = false;
  }
}

async function init() {
  state.ideas = await apiFetch('/ideas/me');

  ideaFilter.innerHTML = `
    <option value="all">All Ideas (aggregated)</option>
    ${state.ideas.map((idea) => `<option value="${idea.id}">${esc(idea.problem)}</option>`).join('')}
  `;

  ideaFilter.addEventListener('change', async () => {
    state.selected = ideaFilter.value;
    state.pollAttempts = 0;
    state.pipelineTriggered = false;
    state.pipelineTriggerError = null;
    clearPolling();
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
    setSummary('No ideas available');
    emptyState({
      icon: '💡',
      title: 'Add an idea to see recommendations',
      text: 'Recommendations appear after you create at least one active project idea.',
      actionHref: '/idea-editor.html',
      actionLabel: 'Create Idea',
    });
    loadMoreBtn.style.display = 'none';
    return;
  }

  await refreshMatches(true);
}

try {
  await init();
} catch (error) {
  clearPolling();
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1 / -1">
      <div class="empty-icon">!</div>
      <div class="empty-title">Unable to load matches</div>
      <div class="empty-text">${esc(error.message || 'Unknown error')}</div>
    </div>
  `;
}
