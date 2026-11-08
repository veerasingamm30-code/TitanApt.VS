import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ApiError, apiData, ensureCsrf } from '../lib/api';

// Keep the real ApiError class; only the network functions are stubbed so the
// provider logic is driven deterministically per scenario.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    ensureCsrf: vi.fn(async () => 'csrf-token'),
    apiData: vi.fn(),
  };
});
const apiDataMock = vi.mocked(apiData);

const learner = {
  id: 'u1',
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'LEARNER' as const,
};

type AuthState = ReturnType<typeof useAuth>;
let snapshot: AuthState | null = null;

function Probe(): ReactNode {
  snapshot = useAuth();
  return null;
}

function renderProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AuthProvider session bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshot = null;
    document.cookie = 'ta_csrf=; Max-Age=0; path=/';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'ta_csrf=; Max-Age=0; path=/';
  });

  it('signs the learner in when /api/auth/me succeeds', async () => {
    apiDataMock.mockResolvedValueOnce({ user: learner } as never);
    renderProvider();
    await waitFor(() => expect(snapshot?.loading).toBe(false));
    expect(snapshot?.user?.email).toBe(learner.email);
    expect(snapshot?.bootstrapError).toBeNull();
  });

  it('treats a definitive 401 as signed out (no error screen, no retry storm)', async () => {
    apiDataMock.mockRejectedValueOnce(new ApiError(401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in.', requestId: 'r1' } }));
    renderProvider();
    await waitFor(() => expect(snapshot?.loading).toBe(false));
    expect(snapshot?.user).toBeNull();
    expect(snapshot?.bootstrapError).toBeNull();
    // exactly one attempt: a 401 is an answer, not a failure to retry
    expect(apiDataMock).toHaveBeenCalledTimes(1);
  });

  it('keeps loading through transient failures, then surfaces a recoverable error without assigning a session', async () => {
    apiDataMock.mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));
    renderProvider();

    // attempt 1 fails -> retry scheduled (~800ms), the provider must still be loading
    await tick(100);
    expect(snapshot?.loading).toBe(true);
    expect(snapshot?.user).toBeNull();
    expect(snapshot?.bootstrapError).toBeNull();

    await tick(900); // attempt 2 runs and fails -> retry scheduled
    expect(snapshot?.loading).toBe(true);

    await tick(900); // attempt 3 runs and fails -> retries exhausted
    await waitFor(() => expect(snapshot?.loading).toBe(false));
    expect(snapshot?.user).toBeNull();
    expect(snapshot?.bootstrapError).toBeTruthy();
    expect(apiDataMock).toHaveBeenCalledTimes(3);
  });

  it('self-heals a single transient failure without ever showing the error screen', async () => {
    apiDataMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    apiDataMock.mockResolvedValueOnce({ user: learner } as never);
    renderProvider();

    // attempt 1 failed -> an automatic retry is pending (~800ms), no session yet
    await tick(100);
    expect(snapshot?.loading).toBe(true);
    expect(snapshot?.bootstrapError).toBeNull();

    // attempt 2 succeeds on its own; the learner is signed in without seeing an error
    await waitFor(() => expect(snapshot?.loading).toBe(false));
    expect(snapshot?.user?.email).toBe(learner.email);
    expect(snapshot?.bootstrapError).toBeNull();
    expect(apiDataMock).toHaveBeenCalledTimes(2);
  });

  it('retryBootstrap re-runs the bootstrap and recovers the session after full failure', async () => {
    apiDataMock.mockRejectedValueOnce(new TypeError('fetch failed #1'));
    apiDataMock.mockRejectedValueOnce(new TypeError('fetch failed #2'));
    apiDataMock.mockRejectedValueOnce(new TypeError('fetch failed #3'));
    apiDataMock.mockResolvedValueOnce({ user: learner } as never);
    renderProvider();
    await waitFor(() => expect(snapshot?.loading).toBe(false));
    expect(snapshot?.user).toBeNull();
    expect(snapshot?.bootstrapError).toBeTruthy();
    expect(apiDataMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      snapshot?.retryBootstrap();
    });
    await waitFor(() => expect(snapshot?.loading).toBe(false));
    expect(snapshot?.user?.email).toBe(learner.email);
    expect(snapshot?.bootstrapError).toBeNull();
    expect(apiDataMock).toHaveBeenCalledTimes(4);
  });
});
