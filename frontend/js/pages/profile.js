import { requireAuth, logout } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';

await requireAuth();
bindSidebar();

const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-account-btn');
const addSkillBtn = document.getElementById('add-skill-btn');
const modalRoot = document.getElementById('modal-root');
const mainContent = document.querySelector('.main-content');
const topbarSubtitle = document.querySelector('.topbar-left .muted');

let activeDialog = null;
let previousFocusedElement = null;
let currentProfile = null;

function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function setProfileField(selector, value) {
  const el = document.querySelector(selector);
  if (el) {
    el.textContent = value;
  }
}

function setAvatarText(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = value;
  el.classList.remove('is-loading');
}

function setProfileActionsDisabled(disabled) {
  for (const button of [editBtn, deleteBtn, addSkillBtn]) {
    if (!button) continue;
    if (disabled) {
      button.setAttribute('disabled', 'disabled');
    } else {
      button.removeAttribute('disabled');
    }
  }
}

function getFocusableElements(root) {
  if (!root) return [];

  const selectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return [...root.querySelectorAll(selectors)].filter((el) => !el.hasAttribute('hidden') && el.getClientRects().length > 0);
}

function handleModalKeydown(event) {
  if (!modalRoot?.classList.contains('open') || !activeDialog) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusable = getFocusableElements(activeDialog);
  if (!focusable.length) {
    event.preventDefault();
    activeDialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function closeModal({ restoreFocus = true } = {}) {
  if (!modalRoot) return;

  modalRoot.classList.remove('open');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
  modalRoot.onclick = null;
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', handleModalKeydown);

  activeDialog = null;
  const focusTarget = previousFocusedElement;
  previousFocusedElement = null;

  if (!restoreFocus) {
    return;
  }

  if (focusTarget instanceof HTMLElement && document.contains(focusTarget)) {
    focusTarget.focus();
    return;
  }

  if (editBtn && document.contains(editBtn) && !editBtn.hasAttribute('disabled')) {
    editBtn.focus();
  }
}

function openModal(markup, { initialFocusSelector } = {}) {
  if (!modalRoot) return;

  previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalRoot.innerHTML = markup;
  modalRoot.classList.add('open');
  modalRoot.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  activeDialog = modalRoot.querySelector('[role="dialog"]');
  if (activeDialog && !activeDialog.hasAttribute('tabindex')) {
    activeDialog.setAttribute('tabindex', '-1');
  }

  modalRoot.onclick = (event) => {
    if (event.target === modalRoot || event.target.closest('[data-close-modal]')) {
      closeModal();
    }
  };

  document.removeEventListener('keydown', handleModalKeydown);
  document.addEventListener('keydown', handleModalKeydown);

  const requested = initialFocusSelector && activeDialog ? activeDialog.querySelector(initialFocusSelector) : null;
  const firstFocusable = getFocusableElements(activeDialog)[0] || activeDialog;
  const focusTarget = requested || firstFocusable;

  queueMicrotask(() => {
    focusTarget?.focus();
  });
}

function showMessageModal(title, message) {
  openModal(
    `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
            <p class="modal-subtitle">${esc(message)}</p>
          </div>
          <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-sm" type="button" data-close-modal>Close</button>
        </div>
      </div>
    `,
    { initialFocusSelector: '.modal-close' },
  );
}

function renderProfileErrorState(message) {
  closeModal({ restoreFocus: false });
  setProfileActionsDisabled(true);

  if (topbarSubtitle) {
    topbarSubtitle.textContent = 'Profile data could not be loaded.';
  }

  if (!mainContent) {
    return;
  }

  mainContent.innerHTML = `
    <section class="profile-section profile-load-error">
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <div class="empty-title">Unable to load profile</div>
        <div class="empty-text">${esc(message || 'Unknown error')}</div>
        <button class="btn btn-primary btn-sm" type="button" id="retry-profile-load">Try again</button>
      </div>
    </section>
  `;

  document.getElementById('retry-profile-load')?.addEventListener('click', () => {
    window.location.reload();
  });
}

async function loadProfile() {
  const [user, ideas, teams, skills] = await Promise.all([
    apiFetch('/users/me'),
    apiFetch('/ideas/me'),
    apiFetch('/teams'),
    apiFetch('/users/me/skills'),
  ]);

  setProfileActionsDisabled(false);
  setProfileField('.profile-name', user.name);
  setProfileField('.profile-email', user.email);
  setAvatarText('.profile-avatar-lg', initials(user.name));

  const stats = document.querySelectorAll('.p-stat-val');
  if (stats[0]) stats[0].textContent = String((teams.teams || []).length);
  if (stats[1]) stats[1].textContent = String((ideas || []).length);
  if (stats[2]) stats[2].textContent = String((skills || []).length);

  const skillsGrid = document.querySelector('#skills-section .skills-grid');
  if (skillsGrid) {
    skillsGrid.innerHTML = (skills || []).length
      ? skills
          .map(
            (skill) => `
              <button type="button" class="skill-tag" data-skill-id="${skill.id}" title="Remove skill">
                ${esc(skill.skill_name)}${skill.level ? ` (${esc(skill.level)})` : ''}
              </button>
            `,
          )
          .join('')
      : '<span class="muted">No skills added yet.</span>';

    for (const tag of skillsGrid.querySelectorAll('.skill-tag')) {
      tag.addEventListener('click', () => openRemoveSkillModal(tag.dataset.skillId, tag.textContent.trim()));
    }
  }

  const githubRow = document.querySelector('#links-section .social-value');
  if (githubRow) {
    const githubUrl = safeHttpUrl(user.github_url);
    githubRow.innerHTML = githubUrl
      ? `<a href="${esc(githubUrl)}" target="_blank" rel="noreferrer">${esc(githubUrl)}</a>`
      : '<span class="muted">Not added</span>';
  }

  const preferenceValues = document.querySelectorAll('#preferences-section .social-value');
  if (preferenceValues[0]) {
    preferenceValues[0].textContent = user.team_size_preference ? `${user.team_size_preference} people` : 'Not set';
  }
  if (preferenceValues[1]) {
    preferenceValues[1].textContent = user.working_style || 'Not set';
  }
  if (preferenceValues[2]) {
    preferenceValues[2].textContent = user.has_existing_team ? 'Yes' : 'No';
  }

  return user;
}

const VALID_STYLES = ['async', 'sync', 'flexible'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

function openEditProfileModal() {
  if (!currentProfile) return;

  openModal(
    `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title">Edit profile</h2>
            <p class="modal-subtitle">Update the details teammates use to understand your working style.</p>
          </div>
          <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
        </div>
        <form class="modal-form" id="edit-profile-form">
          <div class="form-group">
            <label class="form-label" for="profile-name-input">Name</label>
            <input class="form-input" id="profile-name-input" value="${esc(currentProfile.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="profile-github-input">GitHub URL</label>
            <input class="form-input" id="profile-github-input" value="${esc(currentProfile.github_url || '')}" placeholder="https://github.com/username">
          </div>
          <div class="form-group">
            <label class="form-label" for="profile-team-size-input">Preferred team size</label>
            <input class="form-input" id="profile-team-size-input" type="number" min="1" max="20" value="${currentProfile.team_size_preference || ''}" placeholder="3">
          </div>
          <div class="form-group">
            <label class="form-label" for="profile-working-style-input">Working style</label>
            <select class="form-select" id="profile-working-style-input">
              <option value="">Choose a style</option>
              ${VALID_STYLES.map((style) => `<option value="${style}" ${currentProfile.working_style === style ? 'selected' : ''}>${style}</option>`).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
            <button class="btn btn-primary btn-sm" type="submit">Save changes</button>
          </div>
        </form>
      </div>
    `,
    { initialFocusSelector: '#profile-name-input' },
  );

  document.getElementById('edit-profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('profile-name-input')?.value?.trim();
    const github = document.getElementById('profile-github-input')?.value?.trim() || null;
    const teamSizeRaw = document.getElementById('profile-team-size-input')?.value;
    const workingStyle = document.getElementById('profile-working-style-input')?.value || null;
    const teamSize = teamSizeRaw ? Number(teamSizeRaw) || null : null;

    if (workingStyle && !VALID_STYLES.includes(workingStyle)) {
      showMessageModal('Invalid working style', 'Choose one of: async, sync, or flexible.');
      return;
    }

    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: {
          name,
          github_url: github,
          team_size_preference: teamSize,
          working_style: workingStyle,
        },
      });
      closeModal();
      currentProfile = await loadProfile();
    } catch (error) {
      showMessageModal('Unable to update profile', error.message || 'Unknown error');
    }
  });
}

function openAddSkillModal() {
  openModal(
    `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title">Add skill</h2>
            <p class="modal-subtitle">Make it easier for others to understand what you can contribute.</p>
          </div>
          <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
        </div>
        <form class="modal-form" id="add-skill-form">
          <div class="form-group">
            <label class="form-label" for="skill-name-input">Skill name</label>
            <input class="form-input" id="skill-name-input" placeholder="Python, React, UX research">
          </div>
          <div class="form-group">
            <label class="form-label" for="skill-level-input">Skill level</label>
            <select class="form-select" id="skill-level-input">
              <option value="">Optional</option>
              ${VALID_LEVELS.map((level) => `<option value="${level}">${level}</option>`).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
            <button class="btn btn-primary btn-sm" type="submit">Add skill</button>
          </div>
        </form>
      </div>
    `,
    { initialFocusSelector: '#skill-name-input' },
  );

  document.getElementById('add-skill-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const skillName = document.getElementById('skill-name-input')?.value?.trim();
    const level = document.getElementById('skill-level-input')?.value || null;

    if (!skillName) {
      showMessageModal('Skill name required', 'Enter a skill before saving.');
      return;
    }

    try {
      await apiFetch('/users/me/skills', {
        method: 'POST',
        body: { skill_name: skillName, level },
      });
      closeModal();
      await loadProfile();
    } catch (error) {
      showMessageModal('Unable to add skill', error.message || 'Unknown error');
    }
  });
}

function openRemoveSkillModal(skillId, skillLabel) {
  openModal(
    `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title">Remove skill</h2>
            <p class="modal-subtitle">${esc(skillLabel)} will be removed from your public profile.</p>
          </div>
          <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
          <button class="btn btn-danger btn-sm" type="button" id="confirm-remove-skill">Remove</button>
        </div>
      </div>
    `,
    { initialFocusSelector: '[data-close-modal]' },
  );

  document.getElementById('confirm-remove-skill')?.addEventListener('click', async () => {
    try {
      await apiFetch(`/users/me/skills/${skillId}`, { method: 'DELETE' });
      closeModal();
      await loadProfile();
    } catch (error) {
      showMessageModal('Unable to remove skill', error.message || 'Unknown error');
    }
  });
}

function openDeleteAccountModal() {
  openModal(
    `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title">Delete account</h2>
            <p class="modal-subtitle">This permanently deletes your account, ideas, and team data.</p>
          </div>
          <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
        </div>
        <div class="alert alert-error">
          <span>!</span>
          <span>This action cannot be undone.</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
          <button class="btn btn-danger btn-sm" type="button" id="confirm-delete-account">Delete account</button>
        </div>
      </div>
    `,
    { initialFocusSelector: '[data-close-modal]' },
  );

  document.getElementById('confirm-delete-account')?.addEventListener('click', async () => {
    try {
      await apiFetch('/users/me', { method: 'DELETE' });
      closeModal();
      await logout();
    } catch (error) {
      showMessageModal('Unable to delete account', error.message || 'Unknown error');
    }
  });
}

editBtn?.addEventListener('click', openEditProfileModal);
deleteBtn?.addEventListener('click', openDeleteAccountModal);
addSkillBtn?.addEventListener('click', openAddSkillModal);

try {
  currentProfile = await loadProfile();
} catch (error) {
  renderProfileErrorState(error.message || 'Failed to load profile');
}
