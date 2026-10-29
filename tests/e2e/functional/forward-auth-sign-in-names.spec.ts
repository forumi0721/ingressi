/**
 * Functional tests: which names sign in at the forward-auth portal (issue #368).
 *
 * The portal accepts an account's sign-in username, its email address and its
 * portal name (<name>@localhost), not only the portal name. Creates users with
 * real email addresses, grants them access to a forward-auth host, signs in at
 * the portal form and follows the callback to the upstream.
 *
 * Domain: func-fwd-auth-names.test
 */
import { test, expect, type Browser } from '@playwright/test';
import { httpGet, waitForStatus } from '../../helpers/http';

const DOMAIN = 'func-fwd-auth-names.test';
const ECHO_BODY = 'echo-ok';
const BASE_URL = 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;
const HEADERS = { 'Content-Type': 'application/json', Origin: BASE_URL };

const PASSWORD = 'PortalNames2026!';
// Has a username that is not its email address.
const NAMED = { email: 'portal-names-jan@example.com', username: 'portal-names-jan' };
// A "+" keeps the email address from being a username, so this account has none.
const UNNAMED = { email: 'portal-names+pat@example.com' };

let proxyHostId: number;
const userIds: number[] = [];

/** Signs in at the portal form with `name` and returns the callback URL it redirects to. */
async function signInAtPortal(browser: Browser, name: string, password: string) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    // The page leaves for the callback once the sign-in succeeds, so the body is read before it is passed on.
    let result: { status: number; body: { redirectTo?: string; error?: string } } | undefined;
    await page.route('**/api/forward-auth/login', async (route) => {
      const response = await route.fetch();
      result = { status: response.status(), body: await response.json() };
      await route.fulfill({ response });
    });
    await page.goto(`${BASE_URL}/portal?rd=http://${DOMAIN}/names`);
    await expect(page.getByLabel('Username')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Username').fill(name);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect.poll(() => result, { timeout: 15_000 }).toBeDefined();
    return result!;
  } finally {
    await context.close();
  }
}

/** Follows the callback and checks that the session it sets reaches the upstream. */
async function expectUpstreamAccess(redirectTo: string | undefined) {
  expect(redirectTo).toContain('/.ingressi-auth/callback');
  const callback = new URL(redirectTo!);
  const callbackRes = await httpGet(DOMAIN, callback.pathname + callback.search);
  expect(callbackRes.status).toBe(302);
  const cookie = String(callbackRes.headers['set-cookie'] ?? '').match(/_ingressi_fa=([^;]+)/);
  expect(cookie).toBeTruthy();
  const upstream = await httpGet(DOMAIN, '/names', { Cookie: `_ingressi_fa=${cookie![1]}` });
  expect(upstream.status).toBe(200);
  expect(upstream.body).toContain(ECHO_BODY);
}

test.describe.serial('Forward auth portal sign-in names', () => {
  test('setup: users with real email addresses and a forward-auth host they can reach', async ({ page }) => {
    for (const user of [NAMED, UNNAMED]) {
      const res = await page.request.post(`${API}/users`, {
        data: { ...user, password: PASSWORD, role: 'user', name: 'Portal names' },
        headers: HEADERS,
      });
      expect(res.status()).toBe(201);
      userIds.push((await res.json()).id);
    }

    const hostRes = await page.request.post(`${API}/proxy-hosts`, {
      data: {
        name: 'Functional Forward Auth Names',
        domains: [DOMAIN],
        upstreams: ['echo-server:8080'],
        sslForced: false,
        ingressiForwardAuth: { enabled: true },
      },
      headers: HEADERS,
    });
    expect(hostRes.status()).toBe(201);
    proxyHostId = (await hostRes.json()).id;

    const accessRes = await page.request.put(`${API}/proxy-hosts/${proxyHostId}/forward-auth-access`, {
      // User 1 is the primary admin (testadmin), who signs in with its portal name below.
      data: { userIds: [1, ...userIds], groupIds: [] },
      headers: HEADERS,
    });
    expect(accessRes.status()).toBe(200);

    await waitForStatus(DOMAIN, 302, 20_000);
  });

  // Before the sign-ins below: a successful one clears the client's failure count.
  test('a wrong password is still refused for a username', async ({ browser }) => {
    const { status, body } = await signInAtPortal(browser, NAMED.username, 'not-the-password');
    expect(status).toBe(401);
    expect(body.error).toBe('Invalid credentials');
  });

  test('signs in with the sign-in username', async ({ browser }) => {
    const { status, body } = await signInAtPortal(browser, NAMED.username, PASSWORD);
    expect(status).toBe(200);
    await expectUpstreamAccess(body.redirectTo);
  });

  test('signs in with the email address, in any case', async ({ browser }) => {
    const { status, body } = await signInAtPortal(browser, NAMED.email.toUpperCase(), PASSWORD);
    expect(status).toBe(200);
    await expectUpstreamAccess(body.redirectTo);
  });

  test('signs in with the email address when the account has no username', async ({ browser }) => {
    const { status, body } = await signInAtPortal(browser, UNNAMED.email, PASSWORD);
    expect(status).toBe(200);
    await expectUpstreamAccess(body.redirectTo);
  });

  test('signs in with the portal name of an account whose email address is <name>@localhost', async ({ browser }) => {
    // The primary admin, who has always signed in at the portal this way.
    const { status, body } = await signInAtPortal(browser, 'testadmin', 'TestPassword2026!');
    expect(status).toBe(200);
    await expectUpstreamAccess(body.redirectTo);
  });

  // Not a test of its own, so a failed one above does not leave the host and users behind.
  test.afterAll(async ({ request }) => {
    if (proxyHostId) await request.delete(`${API}/proxy-hosts/${proxyHostId}`, { headers: HEADERS });
    for (const id of userIds) await request.delete(`${API}/users/${id}`, { headers: HEADERS });
  });
});
