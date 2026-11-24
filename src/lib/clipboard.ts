export async function copyText(text: string): Promise<void> {
  const focusedElement = document.activeElement;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Embedded browsers can expose the Clipboard API but reject writes.
    }
  }

  // Keep the temporary selection inside a modal so its focus trap allows copying.
  const container = focusedElement?.closest('[role="dialog"], [role="alertdialog"]')
    ?? document.body;
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.tabIndex = -1;
  Object.assign(input.style, {
    position: 'fixed',
    inset: '0 auto auto 0',
    opacity: '0',
    pointerEvents: 'none',
  });

  container.append(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    if (!document.execCommand('copy')) {
      throw new Error('Clipboard write failed');
    }
  } finally {
    input.remove();
    if (focusedElement instanceof HTMLElement && focusedElement.isConnected) {
      focusedElement.focus({ preventScroll: true });
    }
  }
}
