// Runs in WhatsApp's own JS world (manifest: "world": "MAIN") so it can
// redact desktop notification previews before they reach the OS.
// It reads a single flag from <html data-waux-notif> set by the isolated
// content script and never touches message data otherwise.

(() => {
  // Re-injection after an update must not wrap twice.
  if ((window as any).__wauxNotif) return;
  (window as any).__wauxNotif = true;
  const redact = () => document.documentElement.dataset.wauxNotif === '1';
  const scrub = (options: NotificationOptions = {}): NotificationOptions => ({
    ...options,
    body: 'New message',
    icon: undefined,
    image: undefined,
  } as NotificationOptions);

  const Native = window.Notification;
  if (typeof Native === 'function') {
    class WauxNotification extends Native {
      constructor(title: string, options?: NotificationOptions) {
        if (redact()) super('WhatsApp', scrub(options));
        else super(title, options);
      }
    }
    Object.defineProperty(window, 'Notification', { value: WauxNotification, writable: true, configurable: true });
  }

  const proto = window.ServiceWorkerRegistration?.prototype;
  const show = proto?.showNotification;
  if (proto && show) {
    proto.showNotification = function (this: ServiceWorkerRegistration, title: string, options?: NotificationOptions) {
      return redact() ? show.call(this, 'WhatsApp', scrub(options)) : show.call(this, title, options);
    };
  }
})();
