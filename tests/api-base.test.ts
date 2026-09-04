import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, API_BASE } from '@/lib/api-base';

/**
 * The invariant the Android packaging rests on.
 *
 * `apiUrl` is four lines, which is exactly why it is worth pinning: it is the
 * single seam between "the app and its API are the same deployment" and "the app
 * is a file:// document talking to a remote origin". Both halves have to hold at
 * once, and each is only one character away from the other.
 *
 * `API_BASE` is read once at module load, so switching it means re-importing the
 * module under a changed environment rather than reassigning an export.
 */

describe('apiUrl with no configured base', () => {
  /* This is the state of every web build, including the hosted deployment that
     actually serves the route handlers. */
  it('leaves the path untouched, so the request stays same-origin', () => {
    expect(API_BASE).toBe('');
    expect(apiUrl('/api/summary')).toBe('/api/summary');
    expect(apiUrl('/api/triage')).toBe('/api/triage');
    expect(apiUrl('/api/triage/chat')).toBe('/api/triage/chat');
  });

  it('produces exactly the string the pre-refactor call sites hard-coded', () => {
    for (const path of ['/api/summary', '/api/triage', '/api/triage/chat']) {
      expect(apiUrl(path)).toBe(path);
    }
  });
});

describe('apiUrl with a configured base', () => {
  const ORIGIN = 'https://swasthya-setu.example.org';

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('prefixes the origin, yielding an absolute URL', async () => {
    const { apiUrl: scoped, API_BASE: base } = await import('@/lib/api-base');

    expect(base).toBe(ORIGIN);
    expect(scoped('/api/summary')).toBe(`${ORIGIN}/api/summary`);
  });

  /* An APK cannot reach a relative path and a browser will not send patient
     symptom text over plain http from an https document, so every result has to
     be an absolute https URL — not merely a longer string. */
  it('yields a parseable absolute https URL for every route', async () => {
    const { apiUrl: scoped } = await import('@/lib/api-base');

    for (const path of ['/api/summary', '/api/triage', '/api/triage/chat']) {
      const url = new URL(scoped(path));
      expect(url.protocol).toBe('https:');
      expect(url.host).toBe('swasthya-setu.example.org');
      expect(url.pathname).toBe(path);
    }
  });

  it('does not double the slash between origin and path', async () => {
    const { apiUrl: scoped } = await import('@/lib/api-base');

    expect(scoped('/api/summary')).not.toContain('//api');
    expect(scoped('/api/summary').match(/\/\//g)).toHaveLength(1);
  });
});
