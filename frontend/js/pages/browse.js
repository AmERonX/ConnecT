import { requireAuth } from '../auth.js?v=1779876340960';
import { apiFetch } from '../api.js?v=1779876340960';
import { bindSidebar } from '../sidebar.js?v=1779876340960';
import { bindTopbarProfile } from '../topbar.js?v=1779876340960';
import { esc, safeExternalUrl, initials } from '../utils.js?v=1779876340960';

const session = await requireAuth();
bindSidebar();
bindTopbarProfile(session);

const ideaFilter = document.getElementById('idea-filter');
const typeFilter = document.getElementById('type-filter');
const sortFilter = document.getElementById('sort-filter');
const grid = document.querySelector('.match-grid');
const countEl = document.querySelector('.results-count');
const loadMoreBtn = document.getElementById('load-more-btn');

const state = {
  ideas: [],
  selected: 'all',
  type: 'all',
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

function scoreBar(value, label, color) {
  const pct = Math.round((value ?? 0) * 100);
  return `
    <div style="display:flex;align-items:center;gap:6px;font-size:0.7rem;color:var(--text-secondary)">
      <span style="width:62px;flex-shrink:0">${label}</span>
      <div style="flex:1;height:4px;border-radius:2px;background:var(--border);overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;transition:width 0.4s ease"></div>
      </div>
      <span style="width:28px;text-align:right;font-variant-numeric:tabular-nums">${pct}%</span>
    </div>`;
}

const COMMITMENT_LABELS = {
  casual: 'Casual',
  portfolio: 'Portfolio',
  serious: 'Serious',
  startup_seed: 'Startup Seed',
};

function render(items) {
  if (items.length) {
    setSummary(`Showing <strong>${items.length}</strong> matches`);
    grid.innerHTML = items
      .map((item) => {
        const isTeam = !!item?.matched_idea?.team_id;
        function getOwnerName(item) {
          if (item?.matched_idea?.team_id) {
            return item?.matched_idea?.team?.name || 'Unnamed Team';
          }
          return item?.matched_user?.name || 'Unknown User';
        }

        function cardTitle(idea) {
          if (!idea) return 'Unknown Idea';
          if (idea.title && idea.title.trim()) return esc(idea.title);
          if (idea.solution_idea && idea.solution_idea.trim()) {
            const words = idea.solution_idea.trim().split(' ');
            if (words.length <= 5) return esc(idea.solution_idea);
            return esc(words.slice(0, 5).join(' ') + '…');
          }
          const words = (idea.problem || '').trim().split(' ');
          return esc(words.slice(0, 5).join(' ') + '…');
        }
        const ownerName = isTeam 
          ? `Team (Created by ${item?.matched_idea?.owner?.name || 'Unknown User'})` 
          : item?.matched_idea?.owner?.name || 'Unknown User';
        const ownerInitial = isTeam ? '👥' : initials(item?.matched_idea?.owner?.name || 'Unknown User');
        const githubUrl = safeExternalUrl(item?.matched_idea?.owner?.github_url);

        const profileAction = githubUrl
          ? `<a class="btn btn-ghost btn-sm" href="${esc(githubUrl)}" target="_blank" rel="noreferrer noopener">GitHub</a>`
          : '<button class="btn btn-ghost btn-sm" type="button" disabled title="No public profile linked">Profile N/A</button>';

        const commitment = item?.matched_idea?.commitment_level;
        const commitCls = commitment === 'serious' ? 'tag-blue' : commitment === 'portfolio' ? 'tag-purple' : 'tag-amber';
        const commitChip = commitment
          ? `<span class="tag ${commitCls}">${esc(COMMITMENT_LABELS[commitment] || commitment)}</span>`
          : '';
        const teamChip = isTeam 
          ? `<span class="tag tag-pink">Team Idea</span>` 
          : '';

        const hasSubScores = item.embedding_sim != null;
        const scoreBreakdown = hasSubScores ? `
          <div style="display:flex;flex-direction:column;gap:4px;margin:10px 0 2px;padding:10px 0;border-top:1px solid var(--border)">
            ${scoreBar(item.embedding_sim, 'Idea fit', 'var(--primary)')}
            ${scoreBar(item.skill_complement, 'Skill fit', '#10b981')}
            ${scoreBar(item.commitment_compat, 'Commitment', '#f59e0b')}
          </div>` : '';

        const rationale = item.rationale_text
          ? `<p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:8px 0 0;font-style:italic;border-left:2px solid var(--primary);padding-left:8px">${esc(item.rationale_text)}</p>`
          : '';

        return `
        <div class="match-card slide-up">
          <div class="match-header">
            <div class="match-user">
              <div class="avatar avatar-36 av-purple">${isTeam ? ownerInitial : esc(ownerInitial)}</div>
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
          <div style="margin-bottom:12px">
            <h3 class="match-title" style="font-size:1rem;font-weight:600;margin:0 0 4px 0">${cardTitle(item?.matched_idea)}</h3>
            <p class="match-problem" style="margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(item?.matched_idea?.problem || 'No problem statement available.')}</p>
          </div>
          ${scoreBreakdown}
          ${rationale}
          <div class="match-footer" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
            <div class="match-tags" style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="tag ${item.is_stale ? 'tag-amber' : 'tag-green'}">${item.is_stale ? 'Updating' : 'Fresh'}</span>
              ${teamChip}
              ${commitChip}
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
          button.textContent = 'Sent ✓';
          button.style.background = 'var(--green, #10b981)';
        } catch (error) {
          button.removeAttribute('disabled');
          setSummary(`<span style="color:var(--red)">${esc(error.message || 'Failed to send request.')}</span>`);
        }
      });
    }
    return;
  }

  const meta = selectedMeta();
  const anyComputing = meta.some((item) => item.freshness === 'computing');
  const anyScoring   = meta.some((item) => item.freshness === 'partial');
  const allNeedInput = meta.length > 0 && meta.every((item) => item.freshness === 'needs_input');

  if (anyComputing || anyScoring) {
    const timedOut = state.pollAttempts >= state.maxPollAttempts;
    const suffix = state.pipelineTriggerError
      ? ` ${esc(state.pipelineTriggerError)}`
      : timedOut
        ? ' Matching is taking longer than expected.'
        : anyScoring
          ? ' Matches found — scoring them now, this takes a few seconds.'
          : ' We are refreshing recommendations automatically.';
    setSummary(anyScoring ? 'Scoring matches…' : 'Preparing recommendations');
    emptyState({
      icon: '⚡',
      title: anyScoring ? 'Scoring your matches…' : 'Recommendations are still computing',
      text: `${anyScoring ? 'Your matches were found and are being scored.' : 'Your similar ideas are being embedded and rescored.'}${suffix}`,
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
  let items = [];
  if (state.selected === 'all') {
    items = aggregateAll();
  } else {
    items = [...(state.buckets.get(state.selected) || [])];
  }

  if (state.type === 'individuals') {
    items = items.filter(item => !item?.matched_idea?.team_id);
  } else if (state.type === 'teams') {
    items = items.filter(item => !!item?.matched_idea?.team_id);
  }

  render(sortItems(items));
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

function needsPipelineWork(meta) {
  return meta.freshness === 'computing' || meta.freshness === 'partial';
}

function schedulePollingIfNeeded() {
  clearPolling();

  if (!selectedMeta().some(needsPipelineWork)) {
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

    if (selectedMeta().some(needsPipelineWork)) {
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
    ${state.ideas.map((idea) => {
      const label = idea.title
        ? idea.title
        : (idea.problem || '').split(/[.!?]/)[0].trim().slice(0, 55);
      return `<option value="${idea.id}">${esc(label)}</option>`;
    }).join('')}
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

  typeFilter?.addEventListener('change', () => {
    state.type = typeFilter.value;
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
  emptyState({ icon: '!', title: 'Unable to load matches', text: esc(error.message || 'Unknown error') });
}
