import { logout } from './auth.js';

export function bindSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  window.toggleSidebar = () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
  };

  window.closeSidebar = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  };

  overlay?.addEventListener('click', window.closeSidebar);

  const logoutLinks = [...document.querySelectorAll('.sidebar-footer a')].filter((el) =>
    el.textContent?.toLowerCase().includes('log out'),
  );

  for (const link of logoutLinks) {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await logout();
    });
  }

  const page = window.location.pathname.split('/').pop() || 'dashboard.html';
  for (const link of document.querySelectorAll('.sidebar-nav a.sidebar-link')) {
    link.classList.toggle('active', link.getAttribute('href') === page);
  }
}
