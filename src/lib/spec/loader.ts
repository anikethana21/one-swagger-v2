import { parse as parseYaml } from 'yaml';
import type { ParsedSpec, SpecSource } from '../../types';
import { parseSpec } from './parse';
import type { RawObject } from './normalize';

declare const chrome: any;

export class SpecLoadError extends Error {
  hint?: string;
  attempts: string[];
  constructor(message: string, hint?: string, attempts: string[] = []) {
    super(message);
    this.name = 'SpecLoadError';
    this.hint = hint;
    this.attempts = attempts;
  }
}

export interface LoadedSpec {
  spec: ParsedSpec;
  source: SpecSource;
  text: string;
}

function isChromeExtension(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.sendMessage) && Boolean(chrome?.runtime?.id);
}

export function normalizeUrlInput(input: string): string {
  let value = input.trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+(:\d+)?(\/|$)/.test(value) && !value.includes(' ')) return `http://${value}`;
  return value;
}

export async function fetchTextFromUrl(url: string, headers?: Record<string, string>): Promise<{ text: string; finalUrl: string; contentType: string }> {
  if (isChromeExtension()) {
    const response = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The extension proxy did not respond.')), 30000);
      try {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_PROXY',
            payload: { url, options: { method: 'GET', headers: headers || {} } },
          },
          (result: any) => {
            clearTimeout(timer);
            if (chrome.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          },
        );
      } catch (error: any) {
        clearTimeout(timer);
        reject(error);
      }
    });
    if (response?.success && response.data) {
      return {
        text: String(response.data.rawText ?? ''),
        finalUrl: response.data.finalUrl || url,
        contentType: response.data.headers?.['content-type'] || '',
      };
    }
    throw new Error(response?.error || 'Extension proxy request failed.');
  }

  const direct = await fetch(url, {
    headers: { Accept: 'application/json, application/yaml, text/yaml, text/plain, */*', ...(headers || {}) },
    redirect: 'follow',
    credentials: 'omit',
  });
  if (direct.ok) {
    return {
      text: await direct.text(),
      finalUrl: direct.url || url,
      contentType: direct.headers.get('content-type') || '',
    };
  }
  const body = await direct.text().catch(() => '');
  const error = new Error(`HTTP ${direct.status} ${direct.statusText}${body ? ` — ${body.slice(0, 140)}` : ''}`) as Error & { status?: number };
  error.status = direct.status;
  throw error;
}

async function withDevProxy(url: string): Promise<{ text: string; finalUrl: string; contentType: string }> {
  const response = await fetch(`/__cors_proxy?url=${encodeURIComponent(url)}`, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Proxy returned HTTP ${response.status}.`);
  }
  return {
    text: await response.text(),
    finalUrl: url,
    contentType: response.headers.get('content-type') || '',
  };
}

export async function fetchSpecText(url: string): Promise<{ text: string; finalUrl: string }> {
  try {
    const result = await fetchTextFromUrl(url);
    return { text: result.text, finalUrl: result.finalUrl };
  } catch (directError: any) {
    // Browser builds can fall back to the Vite dev proxy. Extension builds use
    // the service worker above. This also makes CORS-blocked specs work in dev.
    try {
      const result = await withDevProxy(url);
      return { text: result.text, finalUrl: result.finalUrl };
    } catch {
      throw directError;
    }
  }
}

export function parseSpecText(text: string): ParsedSpec {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new SpecLoadError('The document is empty.');

  const lowered = trimmed.slice(0, 400).toLowerCase();
  if (lowered.startsWith('<!doctype') || lowered.startsWith('<html')) {
    throw new SpecLoadError(
      'That URL returned an HTML page, not an OpenAPI document.',
      'Use the JSON/YAML spec URL. Common locations are /openapi.json, /swagger.json, /v3/api-docs, or /swagger/v1/swagger.json.',
    );
  }

  let raw: unknown;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      raw = JSON.parse(trimmed);
    } catch (jsonError: any) {
      try {
        raw = parseYaml(trimmed);
      } catch {
        throw new SpecLoadError(`The JSON could not be parsed: ${jsonError.message}`);
      }
    }
  } else {
    try {
      raw = parseYaml(trimmed);
    } catch (yamlError: any) {
      throw new SpecLoadError(`The YAML could not be parsed: ${yamlError.message}`);
    }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SpecLoadError('The document is not a JSON/YAML object.');
  }
  const doc = raw as RawObject;
  if (!doc.openapi && !doc.swagger && !doc.paths) {
    throw new SpecLoadError(
      'This does not look like an OpenAPI document.',
      'A spec needs an "openapi" or "swagger" version field and a "paths" object.',
    );
  }
  if (doc.openapi && !String(doc.openapi).match(/^3\./)) {
    throw new SpecLoadError(`Unsupported OpenAPI version "${doc.openapi}".`, 'One Swagger supports OpenAPI 2.0, 3.0 and 3.1.');
  }
  if (doc.swagger && String(doc.swagger) !== '2.0') {
    throw new SpecLoadError(`Unsupported Swagger version "${doc.swagger}".`, 'Only Swagger 2.0 is supported.');
  }
  try {
    return parseSpec(doc);
  } catch (error: any) {
    throw new SpecLoadError(`The document could not be parsed: ${error.message || error}`);
  }
}

function candidateUrls(input: string): string[] {
  const normalized = normalizeUrlInput(input);
  const candidates: string[] = [];
  let parsed: URL | null = null;
  try {
    parsed = new URL(normalized);
  } catch {
    return [normalized];
  }

  const origin = parsed.origin;
  const pathname = parsed.pathname;
  const looksLikeFile = /\.(json|yaml|yml)$/i.test(pathname);
  if (looksLikeFile) candidates.push(parsed.toString());

  const basePath = pathname.replace(/\/+$/, '');
  const roots = new Set<string>();
  if (basePath && !looksLikeFile) roots.add(basePath);
  if (basePath.endsWith('/docs')) roots.add(basePath.slice(0, -5));
  if (basePath.endsWith('/redoc')) roots.add(basePath.slice(0, -6));
  roots.add('');
  for (const root of roots) {
    for (const path of [
      '/openapi.json',
      '/swagger.json',
      '/v3/api-docs',
      '/api-docs',
      '/api-docs/swagger.json',
      '/swagger/v1/swagger.json',
      '/docs/openapi.json',
      '/openapi.yaml',
      '/swagger.yaml',
    ]) {
      candidates.push(origin + (root || '') + path);
    }
  }
  if (!looksLikeFile) candidates.push(parsed.toString());
  return [...new Set(candidates)];
}

/**
 * Load a spec from a URL. Framework docs URLs are accepted as well: when the
 * given URL is a Swagger UI page or a bare origin, common spec paths are tried.
 */
export async function loadSpecFromUrl(input: string): Promise<LoadedSpec> {
  const candidates = candidateUrls(input);
  const attempts: string[] = [];
  let lastError: Error | null = null;
  let firstSuccessfulText: { text: string; finalUrl: string } | null = null;

  for (const url of candidates) {
    try {
      const result = await fetchSpecText(url);
      attempts.push(`✓ ${url}`);
      firstSuccessfulText = result;
      const spec = parseSpecText(result.text);
      return {
        spec,
        text: result.text,
        source: {
          kind: 'url',
          value: url,
          label: url,
          url: result.finalUrl || url,
        },
      };
    } catch (error: any) {
      attempts.push(`✕ ${url} — ${error?.message || 'failed'}`);
      lastError = error;
    }
  }

  const hint = firstSuccessfulText
    ? 'A document was returned but it could not be parsed as OpenAPI.'
    : 'Check that the server is running and that the spec path is correct. In Chrome, install the extension for zero-CORS access.';
  throw new SpecLoadError(
    `Could not load an OpenAPI document from ${input}.`,
    hint,
    attempts,
  );
}

export async function loadSpecFromText(text: string, label: string, url?: string): Promise<LoadedSpec> {
  const spec = parseSpecText(text);
  return {
    spec,
    text,
    source: {
      kind: url ? 'url' : 'paste',
      value: url || label,
      label,
      text,
      url,
    },
  };
}

export async function detectSpecOnCurrentTab(): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isChromeExtension()) {
    return { ok: false, error: 'Spec detection is available in the Chrome extension.' };
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'DETECT_SPEC' }, (result: any) => {
        if (chrome.runtime?.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(result || { ok: false, error: 'No response from the extension.' });
      });
    } catch (error: any) {
      resolve({ ok: false, error: error.message });
    }
  });
}

export function isExtensionAvailable(): boolean {
  return isChromeExtension();
}
