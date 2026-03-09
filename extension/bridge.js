// ReadyFormAI Chrome Extension - Bridge Script
// Injected into the ReadyFormAI tab to relay PDF data from the extension
// to the React app via window.postMessage

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

  // Chunked transfer state
  let chunkState = null;
  let chunkTimeout = null;

  function clearChunkState() {
    chunkState = null;
    clearTimeout(chunkTimeout);
    chunkTimeout = null;
  }

  function startChunkTimeout() {
    clearTimeout(chunkTimeout);
    chunkTimeout = setTimeout(() => {
      if (chunkState) {
        console.warn('[ReadyFormAI] Chunk transfer timed out, clearing state');
        clearChunkState();
      }
    }, 30000);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // --- Single-message PDF transfer ---
    if (message.type === 'LOAD_PDF_DATA') {
      const uint8Array = base64ToUint8Array(message.data);

      window.postMessage(
        {
          type: 'READYFORM_LOAD_PDF',
          source: 'readyform-extension',
          fileName: message.fileName,
          data: uint8Array.buffer,
        },
        window.location.origin
      );

      sendResponse({ ok: true });
      return true;
    }

    // --- Chunked PDF transfer (for large files) ---
    if (message.type === 'LOAD_PDF_CHUNK') {
      if (!chunkState || message.chunkIndex === 0) {
        clearChunkState();
        chunkState = {
          chunks: new Array(message.totalChunks),
          received: 0,
          totalChunks: message.totalChunks,
          fileName: message.fileName,
        };
      }

      startChunkTimeout();
      chunkState.chunks[message.chunkIndex] = base64ToUint8Array(message.data);
      chunkState.received++;

      // Check if all chunks received
      if (chunkState.received === chunkState.totalChunks) {
        // Calculate total size
        let totalSize = 0;
        for (const chunk of chunkState.chunks) {
          totalSize += chunk.length;
        }

        // Reassemble into single buffer
        const fullData = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunkState.chunks) {
          fullData.set(chunk, offset);
          offset += chunk.length;
        }

        window.postMessage(
          {
            type: 'READYFORM_LOAD_PDF',
            source: 'readyform-extension',
            fileName: chunkState.fileName,
            data: fullData.buffer,
          },
          window.location.origin
        );

        clearChunkState();
      }

      sendResponse({
        ok: true,
        received: chunkState?.received ?? message.totalChunks,
        total: message.totalChunks,
      });
      return true;
    }

    return false;
  });

  // Listen for status requests from the React app
  window.addEventListener('message', (event) => {
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

  console.log('[ReadyFormAI] Bridge script initialized');
})();
