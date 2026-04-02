function createChip(label) {
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.dataset.value = label;
  chip.innerHTML = `${label} <span class="tag-chip-remove" aria-label="Remove tag">✕</span>`;
  chip.querySelector('.tag-chip-remove')?.addEventListener('click', () => chip.remove());
  return chip;
}

export function initTagInput(containerId, inputId, initialTags = []) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) {
    return {
      getTags: () => [],
      setTags: () => {},
    };
  }

  function addTag(value) {
    const normalized = value.trim();
    if (!normalized) return;

    const existing = getTags().map((tag) => tag.toLowerCase());
    if (existing.includes(normalized.toLowerCase())) return;

    const chip = createChip(normalized);
    container.insertBefore(chip, input);
  }

  function getTags() {
    return [...container.querySelectorAll('.tag-chip')].map((chip) => chip.dataset.value || '');
  }

  function setTags(tags) {
    for (const chip of [...container.querySelectorAll('.tag-chip')]) {
      chip.remove();
    }
    for (const tag of tags) {
      addTag(tag);
    }
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(input.value);
      input.value = '';
    }
  });

  container.addEventListener('click', () => input.focus());

  setTags(initialTags);

  return { getTags, setTags, addTag };
}
