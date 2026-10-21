/* One Swagger - MV3 service worker
 * Two jobs: open the app in a full tab, and perform CORS-free fetches for it.
 */

const APP_URL = chrome.runtime.getURL('index.html');

chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch (_) {
    /* older Chromium */
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  const tabs = await chrome.tabs.query({ url: APP_URL + '*' });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
    return;
  }
  const query = tab && tab.url ? `?from=${encodeURIComponent(tab.url)}` : '';
  await chrome.tabs.create({ url: APP_URL + query });
});

function parseBody(text, contentType) {
  if (!text) return null;
  const type = (contentType || '').toLowerCase();
  if (type.includes('json') || /^[\s]*[[{]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }
  return text;
}

async function proxyFetch({ url, options }) {
  const started = performance.now();
  const headers = new Headers(options && options.headers ? options.headers : {});
  const method = (options && options.method) || 'GET';
  const init = {
    method,
    headers,
    redirect: 'follow',
    cache: 'no-store',
    credentials: 'omit',
  };
  if (options && options.body !== undefined && options.body !== null && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const latencyMs = Math.round(performance.now() - started);
  const rawText = await response.text();
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    data: parseBody(rawText, responseHeaders['content-type']),
    rawText,
    latencyMs,
    sizeBytes: new Blob([rawText]).size,
    timestamp: new Date().toISOString(),
    finalUrl: response.url || url,
  };
}

/** Try the usual places frameworks expose their OpenAPI document. */
async function detectSpec() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
    return { ok: false, error: 'The current tab is not a web page.' };
  }
  const origin = new URL(tab.url).origin;
  const candidates = [
    '/openapi.json',
    '/swagger.json',
    '/v3/api-docs',
    '/api-docs',
    '/api-docs/swagger.json',
    '/docs/openapi.json',
    '/swagger/v1/swagger.json',
    '/openapi.yaml',
  ];
  for (const path of candidates) {
    const url = origin + path;
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) continue;
      const text = await response.text();
      if (/"openapi"\s*:/.test(text) || /"swagger"\s*:/.test(text) || /openapi\s*:/.test(text)) {
        return { ok: true, url, origin };
      }
    } catch (_) {
      /* keep looking */
    }
  }
  return { ok: false, error: 'No OpenAPI document found on ' + origin, origin };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'FETCH_PROXY') {
    proxyFetch(message.payload)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message || 'Network request failed' }));
    return true;
  }
  if (message && message.type === 'DETECT_SPEC') {
    detectSpec()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
