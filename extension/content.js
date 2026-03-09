// ReadyFormAI Chrome Extension - Content Script
// Detects PDF pages and auto-redirects to ReadyFormAI

(function () {
  'use strict';

  // Don't run on chrome:// or extension pages
  if (
    window.location.protocol === 'chrome:' ||
    window.location.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // Check if this is the ReadyFormAI app (read configured URL from storage)
  chrome.storage.sync.get({ readyformUrl: 'http://localhost:5173' }, (result) => {
    const configuredOrigin = (() => {
      try { return new URL(result.readyformUrl).origin; } catch { return result.readyformUrl; }
    })();

    const skipOrigins = new Set([
      'http://localhost:5173',
      'https://readyformai.com',
      configuredOrigin,
    ]);

    if (skipOrigins.has(window.location.origin)) return;

    // --- PDF Detection ---
    if (
      window.location.pathname.toLowerCase().endsWith('.pdf') ||
      document.contentType === 'application/pdf'
    ) {
      const pdfUrl = window.location.href;
      let pdfName;
      try {
        const pathname = new URL(pdfUrl).pathname;
        pdfName = decodeURIComponent(pathname.split('/').pop() || 'document.pdf');
      } catch {
        pdfName = 'document.pdf';
      }

      console.log('[ReadyFormAI] PDF detected, sending to ReadyFormAI:', pdfName);

      chrome.runtime.sendMessage({
        type: 'OPEN_PDF_IN_READYFORM',
        pdfUrl: pdfUrl,
        pdfName: pdfName,
      });
    }
  });
})();
