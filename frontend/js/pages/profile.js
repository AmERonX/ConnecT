import { requireAuth, logout } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { bindTopbarProfile } from '../topbar.js';
import { showConfirmDialog } from '../ui/dialogs.js';

const session = await requireAuth();
bindSidebar();
bindTopbarProfile(session);

const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-account-btn');
const addSkillBtn = document.getElementById('add-skill-btn');
const profileFeedback = document.getElementById('profile-feedback');

const profileEditModal = document.getElementById('profile-edit-modal');
const skillModal = document.getElementById('skill-modal');
const profileForm = document.getElementById('profile-form');
const skillForm = document.getElementById('skill-form');
const profileSaveBtn = document.getElementById('profile-save-btn');
const skillSaveBtn = document.getElementById('skill-save-btn');
const profileFormError = document.getElementById('profile-form-error');
const skillFormError = document.getElementById('skill-form-error');

let currentProfile = null;

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

function safeExternalUrl(value) {
  const normalized = String(value || '').trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return null;
  }
  return normalized;
}

function setProfileField(selector, value) {
  const el = document.querySelector(selector);
  if (el) {
    el.textContent = value;
  }
}

function syncBodyModalState() {
  const hasOpenModal = Boolean(document.querySelector('.modal-backdrop:not([hidden])'));
  document.body.classList.toggle('modal-open', hasOpenModal);
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  syncBodyModalState();
  const target = modal.querySelector('input, select, textarea, button');
  target?.focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  syncBodyModalState();
}

function bindModal(modal) {
  if (!modal) return;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  for (const button of modal.querySelectorAll('[data-close-modal]')) {
    button.addEventListener('click', () => closeModal(modal));
  }
}

function renderInlineAlert(container, type, message) {
  if (!container) return;
  if (!message) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.innerHTML = `<div class="alert alert-${type}"><span>${type === 'error' ? '!' : '✓'}</span><span>${esc(message)}</span></div>`;
}

function setPageFeedback(type, message) {
  renderInlineAlert(profileFeedback, type, message);
}

function normalizeGithubUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error('GitHub URL must be a valid http(s) URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('GitHub URL must start with http or https.');
  }

  return url.toString().replace(/\/$/, '');
}

function parseTeamSize(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Preferred team size must be a positive whole number.');
  }

  return parsed;
}

async function loadWithFallback(path, fallback) {
  try {
    const result = await apiFetch(path);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

function renderSkills(skills) {
  const skillsGrid = document.querySelector('#skills-section .skills-grid');
  if (!skillsGrid) return;

  skillsGrid.innerHTML = (skills || []).length
    ? skills
        .map(
          (skill) => `
            <button type="button" class="skill-tag skill-tag-button" data-skill-id="${skill.id}" data-skill-name="${esc(skill.skill_name)}">
              ${esc(skill.skill_name)}${skill.level ? ` (${esc(skill.level)})` : ''} <span style="opacity:0.55;margin-left:4px">×</span>
            </button>
          `,
        )
        .join('')
    : '<span style="color:var(--text-secondary);font-size:0.875rem">No skills added yet.</span>';

  for (const tag of skillsGrid.querySelectorAll('.skill-tag-button')) {
    tag.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog({
        title: 'Remove this skill?',
        message: `This will remove ${tag.dataset.skillName || 'this skill'} from your profile.`,
        confirmLabel: 'Remove skill',
        destructive: true,
      });

      if (!confirmed) return;

      try {
        await apiFetch(`/users/me/skills/${tag.dataset.skillId}`, { method: 'DELETE' });
        await loadProfile();
        setPageFeedback('success', 'Skill removed.');
      } catch (error) {
        setPageFeedback('error', error.message || 'Failed to remove skill.');
      }
    });
  }
}

async function loadProfile() {
  const user = await apiFetch('/users/me');
  const ideas = await loadWithFallback('/ideas/me', []);
  const teams = await loadWithFallback('/teams', { teams: [] });
  const skills = await loadWithFallback('/users/me/skills', []);

  currentProfile = user;

  setProfileField('.profile-name', user.name);
  setProfileField('.profile-email', user.email);
  setProfileField('.profile-avatar-lg', initials(user.name));
  bindTopbarProfile(session, user.name);

  const stats = document.querySelectorAll('.p-stat-val');
  if (stats[0]) stats[0].textContent = String((teams.teams || []).length);
  if (stats[1]) stats[1].textContent = String((ideas || []).length);
  if (stats[2]) stats[2].textContent = String((skills || []).length);

  renderSkills(skills);

  const githubRow = document.querySelector('#links-section .social-value');
  if (githubRow) {
    const githubUrl = safeExternalUrl(user.github_url);
    githubRow.innerHTML = githubUrl
      ? `<a href="${esc(githubUrl)}" target="_blank" rel="noreferrer">${esc(githubUrl)}</a>`
      : '<span style="color:var(--text-muted);font-style:italic">Not added</span>';
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

function populateProfileForm() {
  if (!currentProfile) return;

  document.getElementById('profile-name-input').value = currentProfile.name || '';
  document.getElementById('profile-github-input').value = currentProfile.github_url || '';
  document.getElementById('profile-team-size-input').value = currentProfile.team_size_preference || '';
  document.getElementById('profile-working-style-input').value = currentProfile.working_style || '';
  document.getElementById('profile-existing-team-input').value = currentProfile.has_existing_team ? 'true' : 'false';
  renderInlineAlert(profileFormError, 'error', null);
}

function resetSkillForm() {
  skillForm.reset();
  renderInlineAlert(skillFormError, 'error', null);
}

editBtn?.addEventListener('click', () => {
  if (!currentProfile) return;
  setPageFeedback('error', null);
  populateProfileForm();
  openModal(profileEditModal);
});

addSkillBtn?.addEventListener('click', () => {
  setPageFeedback('error', null);
  resetSkillForm();
  openModal(skillModal);
});

profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderInlineAlert(profileFormError, 'error', null);

  try {
    const name = document.getElementById('profile-name-input').value.trim();
    if (!name) {
      throw new Error('Name is required.');
    }

    const githubUrl = normalizeGithubUrl(document.getElementById('profile-github-input').value);
    const teamSize = parseTeamSize(document.getElementById('profile-team-size-input').value);
    const workingStyle = document.getElementById('profile-working-style-input').value || null;
    const hasExistingTeam = document.getElementById('profile-existing-team-input').value === 'true';

    profileSaveBtn?.setAttribute('disabled', 'disabled');
    await apiFetch('/users/me', {
      method: 'PATCH',
      body: {
        name,
        github_url: githubUrl,
        team_size_preference: teamSize,
        working_style: workingStyle,
        has_existing_team: hasExistingTeam,
      },
    });

    closeModal(profileEditModal);
    await loadProfile();
    setPageFeedback('success', 'Profile updated.');
  } catch (error) {
    renderInlineAlert(profileFormError, 'error', error.message || 'Failed to update profile.');
  } finally {
    profileSaveBtn?.removeAttribute('disabled');
  }
});

skillForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  renderInlineAlert(skillFormError, 'error', null);

  try {
    const skillName = document.getElementById('skill-name-input').value.trim();
    if (!skillName) {
      throw new Error('Skill name is required.');
    }

    const level = document.getElementById('skill-level-input').value || null;

    skillSaveBtn?.setAttribute('disabled', 'disabled');
    await apiFetch('/users/me/skills', {
      method: 'POST',
      body: { skill_name: skillName, level },
    });

    closeModal(skillModal);
    await loadProfile();
    setPageFeedback('success', 'Skill added.');
  } catch (error) {
    renderInlineAlert(skillFormError, 'error', error.message || 'Failed to add skill.');
  } finally {
    skillSaveBtn?.removeAttribute('disabled');
  }
});

deleteBtn?.addEventListener('click', async () => {
  const confirmed = await showConfirmDialog({
    title: 'Delete your account?',
    message: 'This permanently removes your account, ideas, teams, and profile data. This action cannot be undone.',
    confirmLabel: 'Delete account',
    destructive: true,
  });

  if (!confirmed) return;

  try {
    deleteBtn.setAttribute('disabled', 'disabled');
    await apiFetch('/users/me', { method: 'DELETE' });
    await logout();
  } catch (error) {
    deleteBtn.removeAttribute('disabled');
    setPageFeedback('error', error.message || 'Failed to delete account.');
  }
});

bindModal(profileEditModal);
bindModal(skillModal);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (profileEditModal && !profileEditModal.hidden) {
    closeModal(profileEditModal);
    return;
  }
  if (skillModal && !skillModal.hidden) {
    closeModal(skillModal);
  }
});

try {
  await loadProfile();
} catch (error) {
  setPageFeedback('error', error.message || 'Failed to load profile.');
}
