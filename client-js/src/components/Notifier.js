import '../styles/notifier.css';

export function createNotifier() {
  const element = document.createElement('div');
  element.className = 'toasts';

  return {
    element,
    // type: 'info' | 'success' | 'error'
    show(message, type = 'info', durationMs = 4000) {
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = message;
      element.appendChild(toast);
      setTimeout(() => toast.remove(), durationMs);
    },
  };
}