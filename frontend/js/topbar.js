function initials(name) {
  return String(name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';
}

function resolveDisplayName(session, displayName) {
  if (displayName) return displayName;
  return session?.user?.user_metadata?.name || session?.user?.email || 'Builder';
}

export function bindTopbarProfile(session, displayName = null) {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return null;

  const name = resolveDisplayName(session, displayName);
  const text = initials(name);

  let link = topbarRight.querySelector('.topbar-profile-link');
  let avatar = link?.querySelector('.avatar') || null;

  if (!avatar) {
    const existingAvatar = [...topbarRight.querySelectorAll('.avatar')].find(
      (node) => !node.closest('.match-card, .team-row, .member-row, .profile-banner, .match-user'),
    );

    if (existingAvatar) {
      link = document.createElement('a');
      link.href = '/profile.html';
      link.className = 'topbar-profile-link';
      link.setAttribute('aria-label', 'Open profile');
      link.setAttribute('title', name);
      existingAvatar.dataset.topbarProfile = 'true';
      topbarRight.appendChild(link);
      link.appendChild(existingAvatar);
      avatar = existingAvatar;
    }
  }

  if (!avatar) {
    link = document.createElement('a');
    link.href = '/profile.html';
    link.className = 'topbar-profile-link';
    link.setAttribute('aria-label', 'Open profile');
    topbarRight.appendChild(link);

    avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.dataset.topbarProfile = 'true';
    link.appendChild(avatar);
  }

  avatar.textContent = text;
  avatar.title = name;
  link?.setAttribute('title', name);

  return avatar;
}
