import { signup, loginWithGoogle, redirectIfAuthenticated } from '../auth.js';

const form = document.getElementById('signup-form');
const submitBtn = document.getElementById('submit-btn');
const errorBox = document.getElementById('auth-error');
const errorText = document.getElementById('error-text');
const googleBtn = document.getElementById('google-auth-btn');
const passwordField = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');
const passwordBar = document.getElementById('pw-bar');
const passwordHint = document.getElementById('pw-hint');

function showError(message) {
  if (!errorBox || !errorText) return;
  errorText.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  if (!errorBox) return;
  errorBox.hidden = true;
}

function updateStrength(value) {
  if (!passwordBar || !passwordHint) return;

  passwordBar.className = 'password-strength-bar';

  if (!value) {
    passwordHint.textContent = 'Use at least 8 characters with a mix of letters and numbers.';
    return;
  }

  if (value.length < 8) {
    passwordBar.classList.add('pw-weak');
    passwordHint.textContent = 'Too short. Add a few more characters.';
    return;
  }

  const hasNumber = /\d/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);

  if (hasNumber && hasLower && hasUpper) {
    passwordBar.classList.add('pw-strong');
    passwordHint.textContent = 'Strong password.';
  } else if ((hasNumber && hasLower) || (hasLower && hasUpper)) {
    passwordBar.classList.add('pw-medium');
    passwordHint.textContent = 'Good start. Add more variety for a stronger password.';
  } else {
    passwordBar.classList.add('pw-weak');
    passwordHint.textContent = 'Add numbers and mixed case to strengthen it.';
  }
}

await redirectIfAuthenticated();

passwordToggle?.addEventListener('click', () => {
  if (!passwordField) return;
  const nextType = passwordField.type === 'password' ? 'text' : 'password';
  passwordField.type = nextType;
  passwordToggle.textContent = nextType === 'password' ? 'Show' : 'Hide';
  passwordToggle.setAttribute('aria-label', nextType === 'password' ? 'Show password' : 'Hide password');
});

passwordField?.addEventListener('input', () => updateStrength(passwordField.value));

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  submitBtn?.setAttribute('disabled', 'disabled');

  try {
    const name = document.getElementById('name')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const password = passwordField?.value || '';
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
