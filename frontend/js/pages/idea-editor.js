import { requireAuth } from '../auth.js';
import { apiFetch, ApiError } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { initTagInput } from '../tags.js';

await requireAuth();
bindSidebar();

const params = new URLSearchParams(window.location.search);
const ideaId = params.get('id');
const isEditMode = Boolean(ideaId);
const stateIds = ['state-empty', 'state-loading', 'state-revision', 'state-approved', 'state-saving'];

const form = document.getElementById('idea-form');
const analyzeBtn = document.getElementById('submit-btn');
const saveBtn = document.getElementById('save-btn');
const editBtn = document.getElementById('back-edit-btn');
const canonicalTextEl = document.getElementById('canonical-text');
const feedbackListEl = document.getElementById('feedback-list');
const topbarTitle = document.querySelector('.topbar-title');
const editorTitle = document.querySelector('.editor-title');

const tagManager = initTagInput('tag-container', 'tag-field', []);

let canonicalText = null;
let persistedSnapshot = null;
let approvedIntentSnapshot = null;

function showState(id) {
  for (const stateId of stateIds) {
    const el = document.getElementById(stateId);
    if (!el) continue;
    const isActive = stateId === id;
    el.hidden = !isActive;
    el.classList.toggle('visible', isActive);
  }
}

function setStep(step) {
  const dots = [1, 2, 3].map((num) => document.getElementById(`step-${num}`));
  dots.forEach((dot, index) => {
    if (!dot) return;
    dot.classList.toggle('active', index + 1 === step);
    dot.classList.toggle('done', index + 1 < step);
  });
}

function getFormPayload() {
  return {
    problem: document.getElementById('problem')?.value?.trim() || '',
    solution_idea: document.getElementById('solution')?.value?.trim() || null,
    approach: document.getElementById('approach')?.value?.trim() || null,
    tags: tagManager.getTags(),
    commitment_hrs: Number(document.getElementById('hours')?.value || 0) || null,
    duration_weeks: Number(document.getElementById('weeks')?.value || 0) || null,
  };
}

function extractIntent(payload) {
  return {
    problem: payload.problem,
    solution_idea: payload.solution_idea,
    approach: payload.approach,
    tags: payload.tags || [],
  };
}

function sameIntent(a, b) {
  return (
    a.problem === b.problem &&
    a.solution_idea === b.solution_idea &&
    a.approach === b.approach &&
    JSON.stringify(a.tags || []) === JSON.stringify(b.tags || [])
  );
}

function buildAlert(iconText, message) {
  const wrapper = document.createDocumentFragment();
  const icon = document.createElement('span');
  const text = document.createElement('span');
  icon.textContent = iconText;
  text.textContent = message;
  wrapper.append(icon, text);
  return wrapper;
}

function showInlineError(message) {
  const panel = document.getElementById('convo-panel');
  let el = document.getElementById('editor-error');
  if (!panel) return;

  if (!el) {
    el = document.createElement('div');
    el.id = 'editor-error';
    el.className = 'alert alert-error editor-inline-error';
    el.setAttribute('role', 'alert');
    panel.prepend(el);
  }

  el.replaceChildren(buildAlert('!', message));
}

function clearInlineError() {
  const el = document.getElementById('editor-error');
  if (el) el.remove();
}

function renderFeedback(items) {
  if (!feedbackListEl) return;
  feedbackListEl.replaceChildren();

  for (const text of items) {
    const item = document.createElement('li');
    item.className = 'feedback-item';

    const bullet = document.createElement('span');
    bullet.className = 'feedback-bullet';
    bullet.textContent = '→';

    const copy = document.createElement('span');
    copy.textContent = text;

    item.append(bullet, copy);
    feedbackListEl.append(item);
  }
}

function syncCanonicalValidity() {
  if (!approvedIntentSnapshot) {
    return;
  }

  const currentIntent = extractIntent(getFormPayload());
  if (!sameIntent(currentIntent, approvedIntentSnapshot)) {
    canonicalText = null;
    if (canonicalTextEl) {
      canonicalTextEl.textContent = '';
    }
    if (!document.getElementById('state-approved')?.hidden) {
      setStep(1);
      showState('state-empty');
    }
  }
}

function buildPatchPayload(current) {
  if (!persistedSnapshot) {
    return current;
  }

  const payload = {};
  for (const [key, value] of Object.entries(current)) {
    const previous = persistedSnapshot[key];
    const same = Array.isArray(value)
      ? JSON.stringify(value) === JSON.stringify(previous || [])
      : value === previous;

    if (!same) {
      payload[key] = value;
    }
  }

  return payload;
}

async function loadIdea() {
  if (!isEditMode) {
    setStep(1);
    showState('state-empty');
    return;
  }

  const idea = await apiFetch(`/ideas/${ideaId}`);
  document.getElementById('problem').value = idea.problem || '';
  document.getElementById('solution').value = idea.solution_idea || '';
  document.getElementById('approach').value = idea.approach || '';
  document.getElementById('hours').value = idea.commitment_hrs || '';
  document.getElementById('weeks').value = idea.duration_weeks || '';
  tagManager.setTags(idea.tags || []);

  persistedSnapshot = getFormPayload();
  approvedIntentSnapshot = extractIntent(persistedSnapshot);
  canonicalText = idea.canonical_text || null;

  if (topbarTitle) topbarTitle.textContent = 'Edit Idea';
  if (editorTitle) editorTitle.textContent = 'Edit your project idea';

  if (idea.freshness === 'needs_input' || !canonicalText) {
    approvedIntentSnapshot = null;
    setStep(1);
    showState('state-empty');
  } else {
    if (canonicalTextEl) canonicalTextEl.textContent = canonicalText;
    setStep(3);
    showState('state-approved');
  }
}

async function analyze() {
  clearInlineError();
  const payload = getFormPayload();
  if (!payload.problem) {
    showInlineError('Problem is required before analysis.');
    return;
  }

  analyzeBtn?.setAttribute('disabled', 'disabled');
  setStep(2);
  showState('state-loading');

  try {
    const response = await apiFetch('/ideas/canonicalize', {
      method: 'POST',
      body: {
        input: {
          Problem: payload.problem,
          'Solution Idea': payload.solution_idea || '',
          Approach: payload.approach || '',
          Tags: payload.tags,
        },
        previous_canonical_text: null,
        decline_reason: null,
      },
    });

    if (response.status === 'approved') {
      canonicalText = response.canonical_text;
      approvedIntentSnapshot = extractIntent(payload);
      if (canonicalTextEl) canonicalTextEl.textContent = canonicalText;
      setStep(3);
      showState('state-approved');
      return;
    }

    canonicalText = null;
    approvedIntentSnapshot = null;

    if (response.status === 'needs_revision') {
      renderFeedback(response.feedback || []);
      setStep(2);
      showState('state-revision');
      return;
    }

    showInlineError(response.error || 'Canonicalization failed.');
    showState('state-empty');
  } catch (error) {
    canonicalText = null;
    approvedIntentSnapshot = null;
    showInlineError(error.message || 'Failed to analyse idea.');
    showState('state-empty');
  } finally {
    analyzeBtn?.removeAttribute('disabled');
  }
}

async function saveIdea() {
  clearInlineError();
  const current = getFormPayload();

  if (!current.problem) {
    showInlineError('Problem is required.');
    return;
  }

  const currentIntent = extractIntent(current);
  const persistedIntent = persistedSnapshot ? extractIntent(persistedSnapshot) : null;
  const touchesIntent = !persistedIntent || !sameIntent(currentIntent, persistedIntent);
  const isNew = !isEditMode;

  if ((isNew || touchesIntent) && (!canonicalText || !approvedIntentSnapshot || !sameIntent(currentIntent, approvedIntentSnapshot))) {
    showInlineError('Run AI analysis and approve canonical text before saving intent changes.');
    return;
  }

  showState('state-saving');

  try {
    if (isNew) {
      await apiFetch('/ideas', {
        method: 'POST',
        body: {
          ...current,
          canonical_text: canonicalText,
        },
      });
    } else {
      const patchBody = buildPatchPayload(current);
      if (touchesIntent) {
        patchBody.canonical_text = canonicalText;
      }
      await apiFetch(`/ideas/${ideaId}`, {
        method: 'PATCH',
        body: patchBody,
      });
    }

    window.location.href = '/ideas.html';
  } catch (error) {
    showInlineError(error instanceof ApiError ? error.message : 'Failed to save idea.');
    showState(canonicalText ? 'state-approved' : 'state-empty');
  }
}

function backToEdit() {
  setStep(1);
  showState('state-empty');
}

for (const id of ['problem', 'solution', 'approach', 'hours', 'weeks']) {
  document.getElementById(id)?.addEventListener('input', syncCanonicalValidity);
}
document.getElementById('tag-field')?.addEventListener('input', syncCanonicalValidity);
document.getElementById('tag-container')?.addEventListener('click', () => {
  queueMicrotask(syncCanonicalValidity);
});

analyzeBtn?.addEventListener('click', analyze);
saveBtn?.addEventListener('click', saveIdea);
editBtn?.addEventListener('click', backToEdit);

if (form) {
  form.addEventListener('submit', (event) => event.preventDefault());
}

await loadIdea();
