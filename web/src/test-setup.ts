// jsdom has no <dialog> behaviour. This is just enough for components that open and close dialogs.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute('open')) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
