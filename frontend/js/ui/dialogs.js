let activeConfirm = null;

function updateBodyState() {
  const hasOpenModal = Boolean(document.querySelector('.modal-backdrop:not([hidden])'));
  document.body.classList.toggle('modal-open', hasOpenModal);
}

function ensureConfirmDialog() {
  let backdrop = document.getElementById('confirm-dialog');
  if (backdrop) return backdrop;

  backdrop = document.createElement('div');
  backdrop.id = 'confirm-dialog';
  backdrop.className = 'modal-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <div class="modal-panel modal-panel-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="confirm-dialog-title">Confirm action</div>
        </div>
        <button type="button" class="modal-close" data-confirm-close aria-label="Close dialog">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-copy" id="confirm-dialog-message"></p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-confirm-cancel>Cancel</button>
        <button type="button" class="btn btn-primary" data-confirm-accept>Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = (result) => {
    if (!activeConfirm) return;
    const resolver = activeConfirm.resolve;
    activeConfirm = null;
    backdrop.hidden = true;
    updateBodyState();
    resolver(result);
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close(false);
    }
  });

  for (const button of backdrop.querySelectorAll('[data-confirm-close], [data-confirm-cancel]')) {
    button.addEventListener('click', () => close(false));
  }

  backdrop.querySelector('[data-confirm-accept]')?.addEventListener('click', () => close(true));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeConfirm?.backdrop === backdrop && !backdrop.hidden) {
      close(false);
    }
  });

  return backdrop;
}

export async function showConfirmDialog({
  title = 'Confirm action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}) {
  const backdrop = ensureConfirmDialog();
  const titleEl = backdrop.querySelector('#confirm-dialog-title');
  const messageEl = backdrop.querySelector('#confirm-dialog-message');
  const confirmBtn = backdrop.querySelector('[data-confirm-accept]');
  const cancelBtn = backdrop.querySelector('[data-confirm-cancel]');

  titleEl.textContent = title;
  messageEl.textContent = message || '';
  confirmBtn.textContent = confirmLabel;
  cancelBtn.textContent = cancelLabel;
  confirmBtn.classList.toggle('btn-danger', destructive);
  confirmBtn.classList.toggle('btn-primary', !destructive);

  backdrop.hidden = false;
  updateBodyState();

  return new Promise((resolve) => {
    activeConfirm = { resolve, backdrop };
  });
}
