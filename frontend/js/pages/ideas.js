import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { bindTopbarProfile } from '../topbar.js';
import { esc } from '../utils.js';

function freshnessBadge(freshness) {
  const map = {
    fresh:       { cls: 'tag-fresh',       label: 'Fresh' },
    computing:   { cls: 'tag-serious',   label: 'Computing…' },
    partial:     { cls: 'tag-serious',   label: 'Scoring…' },
    needs_input: { cls: 'tag-default', label: 'Needs Input' },
  };
  const chosen = map[freshness] || map.partial;
  return `<span class="tag ${chosen.cls}"> ${chosen.label}</span>`;
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
      <div class="idea-card slide-up" data-idea-id="${idea.id}" style="display:flex;flex-direction:column;gap:12px;padding:16px;border:0.5px solid var(--border);border-radius:12px;background:var(--bg-card);cursor:pointer;transition:border-color var(--t-normal),background var(--t-normal);">
        <div class="idea-card-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:0.5px solid var(--border)">
          <h3 class="idea-card-title" style="font-size:1rem;font-weight:600;margin:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cardTitle(idea)}</h3>
          <a href="/idea-editor.html?id=${idea.id}" class="btn btn-ghost btn-sm" style="padding:0 8px;height:24px" onclick="event.stopPropagation()">Edit</a>
        </div>
        <div class="idea-card-body" style="display:flex;flex-direction:column;gap:12px;flex:1">
          <div>
            <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Problem</div>
            <p style="font-size:0.875rem;color:var(--text-secondary);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(idea.problem)}</p>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Solution Idea</div>
            <p style="font-size:0.875rem;color:var(--text-secondary);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(idea.solution_idea || 'No solution idea provided.')}</p>
          </div>
        </div>
        <div class="idea-card-footer" style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:0.5px solid var(--border)">
          <div class="idea-matches" style="display:flex;align-items:center;gap:6px;font-size:0.875rem;color:var(--text-secondary)">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            ${Number(idea.match_count || 0)} Match${idea.match_count === 1 ? '' : 'es'}
          </div>
          ${freshnessBadge(idea.freshness)}
        </div>
      </div>
    `,
      )
      .join('');

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
