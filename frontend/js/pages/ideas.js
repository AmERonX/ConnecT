import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { bindTopbarProfile } from '../topbar.js';
import { esc } from '../utils.js';

function freshnessBadge(freshness) {
  const map = {
    fresh:       { cls: 'badge-fresh',       label: 'Fresh' },
    computing:   { cls: 'badge-computing',   label: 'Computing…' },
    partial:     { cls: 'badge-computing',   label: 'Scoring…' },
    needs_input: { cls: 'badge-needs-input', label: 'Needs Input' },
  };
  const chosen = map[freshness] || map.partial;
  return `<span class="badge ${chosen.cls}"><span class="badge-dot"></span> ${chosen.label}</span>`;
}

function cardTitle(idea) {
  if (idea.title) return esc(idea.title);
  // Fallback: first sentence of problem (up to 72 chars)
  const first = (idea.problem || '').split(/[.!?]/)[0].trim();
  return esc(first.length > 72 ? first.slice(0, 69) + '…' : first);
}

const session = await requireAuth();
bindSidebar();
bindTopbarProfile(session);

const grid = document.querySelector('.ideas-grid');

try {
  const ideas = await apiFetch('/ideas/me');

  grid.innerHTML =
    ideas
      .map(
        (idea) => `
      <div class="idea-card slide-up" data-idea-id="${idea.id}">
        <div class="idea-card-header">
          <div style="flex:1;min-width:0">
            <h3 class="idea-card-problem" style="font-size:1rem;margin-bottom:3px">${cardTitle(idea)}</h3>
            <p style="font-size:0.78rem;color:var(--text-secondary);margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(idea.problem)}</p>
          </div>
          ${freshnessBadge(idea.freshness)}
        </div>
        <div class="idea-card-footer" style="margin-top:10px">
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${(idea.tags || []).map((tag) => `<span class="tag-chip">${esc(tag)}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="idea-matches">${Number(idea.match_count || 0)} match${idea.match_count === 1 ? '' : 'es'}</div>
            <a href="/idea-editor.html?id=${idea.id}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">Edit</a>
          </div>
        </div>
      </div>
    `,
      )
      .join('') +
    `
    <a href="idea-editor.html" class="idea-new-card slide-up">
      <div class="idea-new-icon">+</div>
      <div style="font-weight:600;font-size:0.9375rem">Add New Idea</div>
      <div style="font-size:0.8125rem;color:var(--text-secondary)">Describe a project and get matched</div>
    </a>
  `;

  for (const card of grid.querySelectorAll('.idea-card')) {
    card.addEventListener('click', () => {
      const ideaId = card.getAttribute('data-idea-id');
      window.location.href = `/idea-editor.html?id=${ideaId}`;
    });
  }
} catch (error) {
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1 / -1">
      <div class="empty-icon">!</div>
      <div class="empty-title">Unable to load ideas</div>
      <div class="empty-text">${esc(error.message || 'Unknown error')}</div>
      <a href="idea-editor.html" class="btn btn-primary btn-sm">Create Idea</a>
    </div>
  `;
}
