import { useEffect, useCallback, useRef } from 'react';
import { useFormContext } from '../store/FormContext';

const EXTENSION_SOURCE = 'readyform-extension';

interface ExtensionPDFMessage {
  type: 'READYFORM_LOAD_PDF';
  source: typeof EXTENSION_SOURCE;
  fileName: string;
  data: ArrayBuffer;
}

function getPDFNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || 'document.pdf';
    return decodeURIComponent(filename);
  } catch {
    return 'document.pdf';
  }
}

export function useExtensionBridge() {
  const { loadPDF, state } = useFormContext();
  const isLoadingRef = useRef(false);
  const loadPDFRef = useRef(loadPDF);
  loadPDFRef.current = loadPDF;

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      // Security: only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      const msg = event.data as ExtensionPDFMessage;
      if (msg?.type !== 'READYFORM_LOAD_PDF' || msg?.source !== EXTENSION_SOURCE) return;

      // ACK immediately so the bridge stops retrying
      window.postMessage(
        { type: 'READYFORM_PDF_ACK', source: 'readyform-app' },
        window.location.origin
      );

      if (isLoadingRef.current) return;

      isLoadingRef.current = true;

      try {
        const blob = new Blob([msg.data], { type: 'application/pdf' });
        const file = new File([blob], msg.fileName || 'document.pdf', {
          type: 'application/pdf',
        });

        console.log('[ExtensionBridge] Received PDF from extension:', msg.fileName);
        await loadPDFRef.current(file);
      } catch (error) {
        console.error('[ExtensionBridge] Failed to load PDF from extension:', error);
      } finally {
        isLoadingRef.current = false;
      }
    },
    [] // stable — uses refs for mutable values
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Handle ?pdfUrl= URL parameter (fallback for same-origin PDFs)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pdfUrl = params.get('pdfUrl');

    if (pdfUrl && !state.pdfLoaded && !isLoadingRef.current) {
      isLoadingRef.current = true;

      fetch(pdfUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buffer) => {
          const blob = new Blob([buffer], { type: 'application/pdf' });
          const file = new File([blob], getPDFNameFromUrl(pdfUrl), {
            type: 'application/pdf',
          });
          return loadPDFRef.current(file);
        })
        .catch((err) => {
          console.error('[ExtensionBridge] Failed to fetch PDF from URL param:', err);
        })
        .finally(() => {
          isLoadingRef.current = false;
          // Clean URL parameters
          window.history.replaceState({}, '', window.location.pathname);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
