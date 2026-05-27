import { signup, loginWithGoogle, redirectIfAuthenticated } from '../auth.js';

const form = document.getElementById('signup-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('auth-error');
const errorText = document.getElementById('error-text');
const googleBtn = document.getElementById('google-auth-btn');

function showError(message) {
  if (!errorBox || !errorText) return;
  errorText.textContent = message;
  errorBox.style.display = 'flex';
}

function clearError() {
  if (!errorBox) return;
  errorBox.style.display = 'none';
}

await redirectIfAuthenticated();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  submitBtn?.setAttribute('disabled', 'disabled');

  try {
    const name = document.getElementById('name')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value || '';
    await signup(name, email, password);
    window.location.href = '/dashboard.html';
  } catch (error) {
    showError(error.message || 'Unable to sign up.');
  } finally {
    submitBtn?.removeAttribute('disabled');
  }
});

googleBtn?.removeAttribute('disabled');
googleBtn?.addEventListener('click', async () => {
  clearError();
  try {
    await loginWithGoogle();
  } catch (error) {
    showError(error.message || 'Google signup failed.');
  }
});
