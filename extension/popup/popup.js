// ReadyFormAI Chrome Extension - Popup Script

function getPDFNameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || 'document.pdf';
    return decodeURIComponent(filename);
  } catch {
    return 'document.pdf';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const launchBtn = document.getElementById('launch-btn');
  const openPdfBtn = document.getElementById('open-pdf-btn');
  const pdfSection = document.getElementById('pdf-section');
  const statusSection = document.getElementById('status-section');
  const statusText = document.getElementById('status-text');
  const statusDetail = document.getElementById('status-detail');
  const statusBadge = document.getElementById('status-badge');
  const settingsLink = document.getElementById('settings-link');
  const settingsView = document.getElementById('settings-view');
  const urlInput = document.getElementById('url-input');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  // --- Check current tab for PDF ---
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.url?.match(/\.pdf(\?|#|$)/i)) {
    pdfSection.classList.remove('hidden');
    openPdfBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'OPEN_PDF_IN_READYFORM',
        pdfUrl: tab.url,
        pdfName: getPDFNameFromUrl(tab.url),
      });
      window.close();
    });
  }

  // --- Get current status ---
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response && response.status !== 'idle') {
      statusSection.classList.remove('hidden');

      if (response.status === 'loading') {
        statusText.textContent = 'Loading PDF...';
        statusBadge.classList.add('loading');
      } else if (response.status === 'processing') {
        statusText.textContent = 'Processing form';
        statusBadge.classList.add('processing');
      } else if (response.status === 'error') {
        statusText.textContent = 'Error';
        statusBadge.classList.add('error');
      }

      if (response.pdfName) {
        statusDetail.textContent = response.pdfName;
      }
    }
  });

  // --- Launch button ---
  launchBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LAUNCH_READYFORM' });
    window.close();
  });

  // --- Settings ---
  const { readyformUrl } = await chrome.storage.sync.get({
    readyformUrl: 'http://localhost:5173',
  });
  urlInput.value = readyformUrl;

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    settingsView.classList.toggle('hidden');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const newUrl = urlInput.value.trim().replace(/\/+$/, '');
    if (newUrl) {
      await chrome.storage.sync.set({ readyformUrl: newUrl });
      settingsView.classList.add('hidden');
      settingsLink.textContent = 'Settings (saved!)';
      setTimeout(() => {
        settingsLink.textContent = 'Settings';
      }, 2000);
    }
  });
});
