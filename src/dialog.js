document.querySelectorAll('dialog').forEach(dialog => {
  Object.assign(dialog, {
    showModal() {
      this.setAttribute('open', '');
    },
    close() {
      this.removeAttribute('open');
    }
  });
  Object.defineProperty(dialog, 'open', {
    set(value) {
      this.toggleAttribute('open', !!value);
    },
    get() {
      return this.hasAttribute('open');
    }
  });
});
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'dialog.css';
document.head.appendChild(link);

document.addEventListener('keydown', ({ key }) => {
  if (key === 'Escape') {
    const openDialogs = document.querySelectorAll('dialog[open]');
    if (openDialogs.length > 0) {
      openDialogs[openDialogs.length - 1].close();
    }
  }
});

// Because otherwise TypeScript complains this is not a module...
export {};
