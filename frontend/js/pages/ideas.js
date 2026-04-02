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

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function freshnessBadge(freshness) {
  const map = {
    fresh: { cls: 'badge-fresh', label: 'Fresh' },
    computing: { cls: 'badge-computing', label: 'Computing' },
    partial: { cls: 'badge-partial', label: 'Partial' },
    needs_input: { cls: 'badge-needs-input', label: 'Needs Input' },
  };
  const chosen = map[freshness] || map.partial;
  return `<span class="badge ${chosen.cls}"><span class="badge-dot"></span> ${chosen.label}</span>`;
}

const session = await requireAuth();
bindSidebar();

const avatar = document.querySelector('.topbar-right .avatar');
if (avatar) {
  avatar.textContent = initials(session?.user?.user_metadata?.name || 'Builder');
  avatar.classList.remove('is-loading');
}

const grid = document.querySelector('.ideas-grid');

try {
  const ideas = await apiFetch('/ideas/me');
  const matchCounts = await Promise.all(
    ideas.map(async (idea) => {
      try {
        const result = await apiFetch(`/ideas/${idea.id}/matches?limit=1`);
        return { ideaId: idea.id, total: result?.total || 0 };
      } catch {
        return { ideaId: idea.id, total: 0 };
      }
    }),
  );

  const countMap = new Map(matchCounts.map((item) => [item.ideaId, item.total]));

  grid.innerHTML =
    ideas
      .map(
        (idea) => `
          <article class="idea-card slide-up" data-idea-id="${idea.id}">
            <div class="idea-card-header">
              <div>
                <h3 class="idea-card-problem">${esc(idea.problem)}</h3>
                <p class="match-meta">${idea.solution_idea ? esc(idea.solution_idea) : 'No solution summary added yet.'}</p>
              </div>
              ${freshnessBadge(idea.freshness)}
            </div>
            <p class="idea-card-approach">${esc(idea.approach || idea.solution_idea || 'No approach added yet.')}</p>
            <div class="idea-card-footer">
              <div class="match-tags">
                ${(idea.tags || []).map((tag) => `<span class="tag-chip">${esc(tag)}</span>`).join('') || '<span class="tag-chip">Untagged</span>'}
              </div>
              <div class="idea-matches">${countMap.get(idea.id) || 0} matches</div>
            </div>
          </article>
        `,
      )
      .join('') +
    `
      <a href="idea-editor.html" class="idea-new-card slide-up">
        <div class="idea-new-icon">+</div>
        <div class="quick-label">Add a new idea</div>
        <div class="quick-desc">Create a fresh brief and start matching.</div>
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
    <div class="empty-state">
      <div class="empty-icon">!</div>
      <div class="empty-title">Unable to load ideas</div>
      <div class="empty-text">${esc(error.message || 'Unknown error')}</div>
      <a href="idea-editor.html" class="btn btn-primary btn-sm">Create idea</a>
    </div>
  `;
}
