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
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

async function getReadyFormUrl() {
  const result = await chrome.storage.sync.get({ readyformUrl: DEFAULT_READYFORM_URL });
  return result.readyformUrl;
}

// --- Tab Management ---

async function getOrOpenReadyFormTab(sourceTabId) {
  const readyformUrl = await getReadyFormUrl();

  // If we have a source tab (the PDF tab), navigate it to ReadyFormAI
  // Use location.replace() so the PDF page is replaced in history (back skips it)
  if (sourceTabId) {
    await chrome.scripting.executeScript({
      target: { tabId: sourceTabId },
      func: (url) => window.location.replace(url),
      args: [readyformUrl],
    });
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

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    let resolved = false;
    function done() {
      if (resolved) return;
      resolved = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        done();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);

    // Also check if already loaded
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') done();
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
  // Decompress each stream and check for /AcroForm inside.
  let pos = 0;
  while (pos < bytes.length - 20) {
    const idx = text.indexOf('stream', pos);
    if (idx === -1) break;

    let dataStart = idx + 6;
    if (bytes[dataStart] === 0x0d && bytes[dataStart + 1] === 0x0a) dataStart += 2;
    else if (bytes[dataStart] === 0x0a) dataStart += 1;
    else { pos = idx + 6; continue; }

    const endIdx = text.indexOf('endstream', dataStart);
    if (endIdx === -1) break;

    const streamData = bytes.slice(dataStart, endIdx);

    try {
      const decompressed = await inflate(streamData);
      const decompText = new TextDecoder('latin1').decode(decompressed);
      if (decompText.includes('/AcroForm')) return true;
    } catch {
      // Not a flate stream or corrupt — skip
    }

    pos = endIdx + 9;
  }

  return false;
}

// Decompress deflate data using the DecompressionStream API (available in service workers)
async function inflate(data) {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(data);
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// --- Core PDF Handling ---

async function handleOpenPDF(pdfUrl, pdfName, sourceTabId) {
  // Prevent duplicate handling of the same PDF
  if (currentState.status === 'loading' && currentState.pdfUrl === pdfUrl) return;

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
      return;
    }

    console.log('[ReadyFormAI] Fillable PDF detected, opening in ReadyFormAI:', pdfName);

    // 3. Navigate the source tab to ReadyFormAI
    const tab = await getOrOpenReadyFormTab(sourceTabId);
    readyformTabId = tab.id;

    // 4. Wait for the tab to finish loading
    await waitForTabLoad(tab.id);

    // 5. Small delay to ensure React app is mounted
    await new Promise((r) => setTimeout(r, 500));

    // 6. Inject the bridge script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['bridge.js'],
    });

    // 7. Small delay for bridge to initialize
    await new Promise((r) => setTimeout(r, 100));

    // 8. Send PDF data to the bridge script
    await sendPDFToTab(tab.id, arrayBuffer, pdfName);

    currentState = { status: 'processing', pdfName, pdfUrl: null };
  } catch (error) {
    console.error('[ReadyFormAI] Failed to handle PDF:', error);
    currentState = { status: 'error', pdfName, pdfUrl: null, error: error.message };
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

// --- Tab Cleanup ---

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === readyformTabId) {
    readyformTabId = null;
    currentState = { status: 'idle', pdfName: null, pdfUrl: null };
  }
});
