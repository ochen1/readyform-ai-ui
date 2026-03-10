// ReadyFormAI Chrome Extension - Background Service Worker
// Handles PDF fetching and forwarding to the web app

const DEFAULT_READYFORM_URL = 'http://localhost:5173';
const CHUNK_SIZE = 512 * 1024; // 512KB chunks for large PDFs

let readyformTabId = null;
let currentState = { status: 'idle', pdfName: null, pdfUrl: null };

// --- Utility Functions ---

function getPDFNameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || 'document.pdf';
    return decodeURIComponent(filename);
  } catch {
    return 'document.pdf';
  }
}

function uint8ArrayToBase64(uint8Array) {
  const BATCH = 8192;
  const parts = [];
  for (let i = 0; i < uint8Array.length; i += BATCH) {
    parts.push(String.fromCharCode.apply(null, uint8Array.subarray(i, i + BATCH)));
  }
  return btoa(parts.join(''));
}

async function getReadyFormUrl() {
  const result = await chrome.storage.sync.get({ readyformUrl: DEFAULT_READYFORM_URL });
  return result.readyformUrl;
}

// --- Tab Management ---

async function getOrOpenReadyFormTab(sourceTabId) {
  const readyformUrl = await getReadyFormUrl();

  // If we have a source tab (the PDF tab), navigate it to ReadyFormAI.
  // Use chrome.tabs.update (not location.replace via executeScript) because
  // Chrome's built-in PDF viewer may block or mishandle injected scripts.
  if (sourceTabId) {
    await chrome.tabs.update(sourceTabId, { url: readyformUrl });
    readyformTabId = sourceTabId;
    return await chrome.tabs.get(sourceTabId);
  }

  // Check if we have a tracked tab that's still valid
  if (readyformTabId !== null) {
    try {
      const tab = await chrome.tabs.get(readyformTabId);
      if (tab && tab.url && tab.url.startsWith(readyformUrl)) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        return tab;
      }
    } catch {
      readyformTabId = null;
    }
  }

  // Search for an existing ReadyFormAI tab using URL filter
  const tabs = await chrome.tabs.query({ url: [`${readyformUrl}/*`] });
  if (tabs.length > 0) {
    const tab = tabs[0];
    readyformTabId = tab.id;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return tab;
  }

  // No existing tab and no source tab — open a new one
  const newTab = await chrome.tabs.create({ url: readyformUrl });
  readyformTabId = newTab.id;
  return newTab;
}

function waitForTabLoad(tabId, expectedUrlPrefix) {
  return new Promise((resolve) => {
    let resolved = false;
    function done() {
      if (resolved) return;
      resolved = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function isReady(status, url) {
      if (status !== 'complete') return false;
      // When navigating the PDF tab to ReadyFormAI, the tab briefly reports
      // 'complete' from the *previous* page before navigation starts.
      // Verify the URL matches to avoid injecting the bridge too early.
      if (expectedUrlPrefix && (!url || !url.startsWith(expectedUrlPrefix))) return false;
      return true;
    }
    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && isReady(changeInfo.status, tab.url)) {
        done();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);

    // Also check if already loaded at the right URL
    chrome.tabs.get(tabId).then((tab) => {
      if (isReady(tab.status, tab.url)) done();
    });

    // Timeout after 15s to avoid hanging forever
    setTimeout(done, 15000);
  });
}

// --- PDF Transfer ---

async function sendPDFToTab(tabId, arrayBuffer, fileName) {
  const uint8Array = new Uint8Array(arrayBuffer);
  const totalSize = uint8Array.length;

  if (totalSize <= CHUNK_SIZE) {
    // Base64 encode to avoid Array.from memory bloat (~33% overhead vs ~800%)
    await chrome.tabs.sendMessage(tabId, {
      type: 'LOAD_PDF_DATA',
      data: uint8ArrayToBase64(uint8Array),
      fileName: fileName,
    });
  } else {
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = uint8Array.slice(start, end);

      await chrome.tabs.sendMessage(tabId, {
        type: 'LOAD_PDF_CHUNK',
        data: uint8ArrayToBase64(chunk),
        chunkIndex: i,
        totalChunks: totalChunks,
        fileName: fileName,
      });
    }
  }
}

// --- PDF Form Detection ---

async function isFillablePDF(arrayBuffer) {
  // Check for /AcroForm in raw bytes first (uncompressed PDFs)
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('latin1').decode(bytes);
  if (text.includes('/AcroForm')) return true;

  // Many PDFs store the catalog in compressed object streams (/ObjStm + /FlateDecode).
  // Decompress streams and check for /AcroForm inside. Cap at 20 streams to avoid
  // excessive work on non-fillable PDFs.
  const MAX_STREAMS = 20;
  let streamsChecked = 0;
  let pos = 0;
  while (pos < bytes.length - 20 && streamsChecked < MAX_STREAMS) {
    const idx = text.indexOf('\nstream', pos);
    if (idx === -1) break;

    // Skip past the newline that matched, then past "stream"
    let dataStart = idx + 7; // length of "\nstream"
    if (bytes[dataStart] === 0x0d && bytes[dataStart + 1] === 0x0a) dataStart += 2;
    else if (bytes[dataStart] === 0x0a) dataStart += 1;
    else { pos = idx + 7; continue; }

    const endIdx = text.indexOf('\nendstream', dataStart);
    if (endIdx === -1) break;

    const streamData = bytes.slice(dataStart, endIdx);
    streamsChecked++;

    try {
      const decompressed = await inflate(streamData);
      const decompText = new TextDecoder('latin1').decode(decompressed);
      if (decompText.includes('/AcroForm')) return true;
    } catch {
      // Not a flate stream or corrupt — skip
    }

    pos = endIdx + 10; // length of "\nendstream"
  }

  return false;
}

// Decompress deflate data using the DecompressionStream API (available in service workers)
// Caps output at MAX_DECOMPRESSED_SIZE to guard against zip bombs.
const MAX_DECOMPRESSED_SIZE = 10 * 1024 * 1024; // 10 MB

async function inflate(data) {
  // Try zlib-wrapped deflate first (spec-compliant PDFs), then raw deflate
  try {
    return await inflateWithMode(data, 'deflate');
  } catch {
    return await inflateWithMode(data, 'deflate-raw');
  }
}

async function inflateWithMode(data, mode) {
  const ds = new DecompressionStream(mode);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  // Fire-and-forget: don't await writes — awaiting would deadlock because the
  // readable side hasn't started draining yet. Capture rejections instead.
  let writeError = null;
  writer.write(data).catch((e) => { writeError = e; });
  writer.close().catch(() => {});

  const chunks = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLen += value.length;
    if (totalLen > MAX_DECOMPRESSED_SIZE) {
      await reader.cancel();
      throw new Error('Decompressed stream exceeds size limit');
    }
    chunks.push(value);
  }

  if (writeError) throw writeError;

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// --- Core PDF Handling ---

// Returns true if the PDF was fillable and handled, false otherwise
async function handleOpenPDF(pdfUrl, pdfName, sourceTabId) {
  // Prevent duplicate handling of the same PDF
  if (currentState.status === 'loading' && currentState.pdfUrl === pdfUrl) return false;

  currentState = { status: 'loading', pdfName, pdfUrl };

  try {
    // 1. Fetch the PDF first to check if it's fillable
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    // 2. Check if this PDF has form fields — if not, let the default viewer handle it
    if (!(await isFillablePDF(arrayBuffer))) {
      console.log('[ReadyFormAI] PDF has no form fields, skipping:', pdfName);
      currentState = { status: 'idle', pdfName: null, pdfUrl: null };
      return false;
    }

    console.log('[ReadyFormAI] Fillable PDF detected, opening in ReadyFormAI:', pdfName);

    // 3. Navigate the source tab to ReadyFormAI
    const readyformUrl = await getReadyFormUrl();
    const tab = await getOrOpenReadyFormTab(sourceTabId);
    readyformTabId = tab.id;

    // 4. Wait for the tab to finish loading the ReadyFormAI page
    await waitForTabLoad(tab.id, readyformUrl);

    // 5. Verify the tab actually loaded ReadyFormAI (not an error page)
    const loadedTab = await chrome.tabs.get(tab.id);
    if (!loadedTab.url || !loadedTab.url.startsWith(readyformUrl)) {
      throw new Error(`ReadyFormAI failed to load (got ${loadedTab.url || 'no URL'})`);
    }

    // 6. Small delay to ensure React app is mounted
    await new Promise((r) => setTimeout(r, 500));

    // 7. Inject the bridge script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['bridge.js'],
    });

    // 8. Small delay for bridge to initialize
    await new Promise((r) => setTimeout(r, 100));

    // 9. Send PDF data to the bridge script
    await sendPDFToTab(tab.id, arrayBuffer, pdfName);

    currentState = { status: 'processing', pdfName, pdfUrl: null };
    return true;
  } catch (error) {
    console.error('[ReadyFormAI] Failed to handle PDF:', error);
    currentState = { status: 'error', pdfName, pdfUrl: null, error: error.message };
    return false;
  }
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_PDF_IN_READYFORM') {
    const sourceTabId = sender.tab?.id || message.sourceTabId || null;
    handleOpenPDF(
      message.pdfUrl,
      message.pdfName || getPDFNameFromUrl(message.pdfUrl),
      sourceTabId
    );
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_STATUS') {
    sendResponse(currentState);
  }

  if (message.type === 'GET_READYFORM_ORIGIN') {
    getReadyFormUrl().then((url) => {
      try {
        sendResponse(new URL(url).origin);
      } catch {
        sendResponse(url);
      }
    });
    return true; // async sendResponse
  }

  if (message.type === 'LAUNCH_READYFORM') {
    getOrOpenReadyFormTab(null);
    sendResponse({ ok: true });
  }

  return true;
});

// --- Download Interception ---
// Catches PDFs that download immediately (Content-Disposition: attachment)
// instead of navigating to a PDF page where the content script would detect them.
// Uses pause/resume to preserve auth cookies and avoid re-triggering issues.

// Track download IDs we cancelled so we only erase our own from the download bar
const cancelledDownloadIds = new Set();

chrome.downloads.onCreated.addListener((downloadItem) => {
  // Check if this is a PDF download
  const isPDF =
    (downloadItem.mime && downloadItem.mime === 'application/pdf') ||
    (downloadItem.filename && downloadItem.filename.toLowerCase().endsWith('.pdf')) ||
    (downloadItem.url && downloadItem.url.toLowerCase().split('?')[0].endsWith('.pdf'));

  if (!isPDF) return;

  const pdfUrl = downloadItem.finalUrl || downloadItem.url;
  const urlDerivedName = getPDFNameFromUrl(pdfUrl);
  const pdfName = urlDerivedName !== 'document.pdf'
    ? urlDerivedName
    : (downloadItem.filename
        ? downloadItem.filename.split(/[/\\]/).pop() || 'document.pdf'
        : 'document.pdf');

  console.log('[ReadyFormAI] Intercepted PDF download:', pdfName);

  // Pause the download while we check if the PDF is fillable
  chrome.downloads.pause(downloadItem.id, () => {
    const pauseError = chrome.runtime.lastError;

    handleOpenPDF(pdfUrl, pdfName, null)
      .then((handled) => {
        if (handled) {
          // Fillable PDF — cancel the original download and clean up
          console.log('[ReadyFormAI] Handled as fillable PDF, cancelling download:', pdfName);
          cancelledDownloadIds.add(downloadItem.id);
          chrome.downloads.cancel(downloadItem.id, () => {
            chrome.downloads.erase({ id: downloadItem.id });
            cancelledDownloadIds.delete(downloadItem.id);
          });
        } else {
          // Not fillable — resume the original download
          console.log('[ReadyFormAI] Not fillable, resuming download:', pdfName);
          if (!pauseError) {
            chrome.downloads.resume(downloadItem.id);
          }
        }
      })
      .catch(() => {
        // On any failure, resume the original download
        if (!pauseError) {
          chrome.downloads.resume(downloadItem.id);
        }
      });
  });
});

// --- Tab Cleanup ---

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === readyformTabId) {
    readyformTabId = null;
    currentState = { status: 'idle', pdfName: null, pdfUrl: null };
  }
});
