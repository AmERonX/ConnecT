import { login, loginWithGoogle, redirectIfAuthenticated } from '../auth.js';

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('auth-error');
const errorText = document.getElementById('error-text');
const googleBtn = document.getElementById('google-auth-btn');
const passwordField = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');

function showError(message) {
  if (!errorBox || !errorText) return;
  errorText.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  if (!errorBox) return;
  errorBox.hidden = true;
}

await redirectIfAuthenticated();

passwordToggle?.addEventListener('click', () => {
  if (!passwordField) return;
  const nextType = passwordField.type === 'password' ? 'text' : 'password';
  passwordField.type = nextType;
  passwordToggle.textContent = nextType === 'password' ? 'Show' : 'Hide';
  passwordToggle.setAttribute('aria-label', nextType === 'password' ? 'Show password' : 'Hide password');
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  submitBtn?.setAttribute('disabled', 'disabled');

  try {
    const email = document.getElementById('email')?.value?.trim();
    const password = passwordField?.value || '';
    await login(email, password);
    window.location.href = '/dashboard.html';
  } catch (error) {
    showError(error.message || 'Unable to log in.');
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
    showError(error.message || 'Google login failed.');
  }
});
