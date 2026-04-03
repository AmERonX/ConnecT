import { requireAuth, logout } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';

await requireAuth();
bindSidebar();

const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-account-btn');

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

function setProfileField(selector, value) {
  const el = document.querySelector(selector);
  if (el) {
    el.textContent = value;
  }
}

async function loadWithFallback(path, fallback) {
  try {
    const result = await apiFetch(path);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

async function loadProfile() {
  const user = await apiFetch('/users/me');
  const ideas = await loadWithFallback('/ideas/me', []);
  const teams = await loadWithFallback('/teams', { teams: [] });
  const skills = await loadWithFallback('/users/me/skills', []);

  setProfileField('.profile-name', user.name);
  setProfileField('.profile-email', user.email);
  setProfileField('.profile-avatar-lg', initials(user.name));

  const stats = document.querySelectorAll('.p-stat-val');
  if (stats[0]) stats[0].textContent = String((teams.teams || []).length);
  if (stats[1]) stats[1].textContent = String((ideas || []).length);
  if (stats[2]) stats[2].textContent = String((skills || []).length);

  const skillsGrid = document.querySelector('#skills-section .skills-grid');
  if (skillsGrid) {
    skillsGrid.innerHTML = (skills || []).length
      ? skills
          .map(
            (skill) =>
              `<span class="skill-tag" style="cursor:pointer" title="Click to remove" data-skill-id="${skill.id}">
                 ${esc(skill.skill_name)}${skill.level ? ` (${esc(skill.level)})` : ''} <span style="opacity:0.5;margin-left:4px">×</span>
               </span>`,
          )
          .join('')
      : '<span style="color:var(--text-secondary);font-size:0.875rem">No skills added yet.</span>';

    for (const tag of skillsGrid.querySelectorAll('.skill-tag')) {
      tag.addEventListener('click', async () => {
        if (!confirm('Remove this skill?')) return;
        try {
          await apiFetch(`/users/me/skills/${tag.dataset.skillId}`, { method: 'DELETE' });
          await loadProfile();
        } catch (error) {
          alert('Failed to delete skill: ' + (error.message || 'Unknown error'));
        }
      });
    }
  }

  const githubRow = document.querySelector('#links-section .social-value');
  if (githubRow) {
    githubRow.innerHTML = user.github_url
      ? `<a href="${esc(user.github_url)}" target="_blank" rel="noreferrer">${esc(user.github_url)}</a>`
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

let currentProfile = null;

const VALID_STYLES = ['async', 'sync', 'flexible'];

async function editProfile() {
  if (!currentProfile) return;

  const name = prompt('Name', currentProfile.name || '') || currentProfile.name;
  const github = prompt('GitHub URL', currentProfile.github_url || '') || null;
  const teamSizeInput = prompt('Preferred team size', currentProfile.team_size_preference || '');
  const teamSize = teamSizeInput ? Number(teamSizeInput) || null : null;
  const workingStyle = prompt('Working style (async, sync, flexible)', currentProfile.working_style || '') || null;

  if (workingStyle && !VALID_STYLES.includes(workingStyle.toLowerCase())) {
    alert('Working style must be one of: async, sync, flexible');
    return;
  }

  await apiFetch('/users/me', {
    method: 'PATCH',
    body: {
      name,
      github_url: github,
      team_size_preference: teamSize,
      working_style: workingStyle ? workingStyle.toLowerCase() : null,
    },
  });

  currentProfile = await loadProfile();
}

editBtn?.addEventListener('click', async () => {
  try {
    await editProfile();
  } catch (error) {
    alert(error.message || 'Failed to update profile.');
  }
});

deleteBtn?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
  try {
    await apiFetch('/users/me', { method: 'DELETE' });
    await logout();
  } catch (error) {
    alert(error.message || 'Failed to delete account.');
  }
});

document.getElementById('add-skill-btn')?.addEventListener('click', async () => {
  const skillName = prompt('Skill name (e.g. Python, React)');
  if (!skillName?.trim()) return;

  let level = prompt('Skill level (beginner, intermediate, advanced) - Optional') || null;
  const validLevels = ['beginner', 'intermediate', 'advanced'];

  if (level && !validLevels.includes(level.toLowerCase())) {
    alert('Invalid skill level. Must be beginner, intermediate, or advanced.');
    return;
  }

  try {
    await apiFetch('/users/me/skills', {
      method: 'POST',
      body: { skill_name: skillName.trim(), level: level ? level.toLowerCase() : null },
    });
    await loadProfile();
  } catch (error) {
    alert(error.message || 'Failed to add skill.');
  }
});

try {
  currentProfile = await loadProfile();
} catch (error) {
  const skillsSection = document.getElementById('skills-section');
  if (skillsSection) {
    skillsSection.innerHTML = `<div class="alert alert-error"><span>!</span><span>${esc(error.message || 'Failed to load profile')}</span></div>`;
  }
}