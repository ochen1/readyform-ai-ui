// ReadyFormAI Chrome Extension - Bridge Script
// Injected into the ReadyFormAI tab to relay PDF data from the extension
// to the React app via window.postMessage.
//
// Reads the PDF from chrome.storage.local (written by background.js) and
// retries delivery on an exponential backoff until the React app ACKs.

(function () {
  'use strict';

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  let delivered = false;
  let retryTimer = null;

  // Exponential backoff: 0, .5s, 1s, 2s, 4s, 8s, 16s, 30s, 60s
  const RETRY_DELAYS = [0, 500, 1000, 2000, 4000, 8000, 16000, 30000, 60000];

  function deliverToApp(fileName, arrayBuffer) {
    const msg = {
      type: 'READYFORM_LOAD_PDF',
      source: 'readyform-extension',
      fileName,
      data: arrayBuffer,
    };

    let attempt = 0;

    function tryDeliver() {
      if (delivered) return;
      console.log('[ReadyFormAI] Delivering PDF to app, attempt', attempt + 1);
      window.postMessage(msg, window.location.origin);
      attempt++;
      if (attempt < RETRY_DELAYS.length) {
        retryTimer = setTimeout(tryDeliver, RETRY_DELAYS[attempt]);
      }
    }

    tryDeliver();
  }

  // Listen for ACK from the React app — stop retrying and clean up storage
  window.addEventListener('message', (event) => {
    if (
      event.data?.type === 'READYFORM_PDF_ACK' &&
      event.data?.source === 'readyform-app'
    ) {
      delivered = true;
      clearTimeout(retryTimer);
      chrome.storage.local.remove('pendingPDF');
      console.log('[ReadyFormAI] PDF delivery acknowledged');
    }

    // Status requests from the React app
    if (
      event.data?.type === 'READYFORM_STATUS_REQUEST' &&
      event.data?.source === 'readyform-app'
    ) {
      chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
        window.postMessage(
          {
            type: 'READYFORM_STATUS_RESPONSE',
            source: 'readyform-extension',
            status: response,
          },
          window.location.origin
        );
      });
    }
  });

  // Read pending PDF from storage and start delivery
  chrome.storage.local.get('pendingPDF', (result) => {
    if (!result.pendingPDF) {
      console.log('[ReadyFormAI] No pending PDF in storage');
      return;
    }

    const { data, fileName } = result.pendingPDF;
    console.log('[ReadyFormAI] Read pending PDF from storage:', fileName);
    const uint8Array = base64ToUint8Array(data);
    deliverToApp(fileName, uint8Array.buffer);
  });

  console.log('[ReadyFormAI] Bridge script initialized');
})();
