// The request helpers behind /api/auth and /api/billing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestOrigin, sameOrigin, safeNext, loginError } from '../lib/login.ts';

const req = (url, headers = {}) => new Request(url, { headers });

test('requestOrigin prefers the forwarded host and proto (Vercel)', () => {
  assert.equal(requestOrigin(req('http://127.0.0.1:3000/api/auth/otp', { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'app.thefutureclips.com' })), 'https://app.thefutureclips.com');
  assert.equal(requestOrigin(req('http://localhost:3100/x', { host: 'localhost:3100' })), 'http://localhost:3100');
  assert.equal(requestOrigin(req('https://a.example/x', { 'x-forwarded-host': 'a.example, proxy.internal' })), 'https://a.example');
});

test('sameOrigin refuses a cross-site Origin and accepts none or a matching one', () => {
  assert.equal(sameOrigin(req('https://a.example/x', { host: 'a.example', origin: 'https://evil.example' })), false);
  assert.equal(sameOrigin(req('https://a.example/x', { host: 'a.example', origin: 'https://a.example' })), true);
  assert.equal(sameOrigin(req('https://a.example/x', { host: 'a.example' })), true);
});

test('safeNext only ever lands on this host', () => {
  assert.equal(safeNext('/app?page=library'), '/app?page=library');
  assert.equal(safeNext('//evil.example/phish'), '/app');
  assert.equal(safeNext('https://evil.example'), '/app');
  assert.equal(safeNext(undefined), '/app');
  assert.equal(safeNext(42), '/app');
});

test('loginError maps the invite gate and the mailer limit to sentences and statuses', () => {
  assert.equal(loginError('Database error saving new user').status, 403);
  assert.equal(loginError('FC_INVITE_ONLY: not invited').status, 403);
  assert.equal(loginError('email rate limit exceeded').status, 429);
  assert.deepEqual(loginError('Something else'), { error: 'Something else', status: 400 });
});

test('requestOrigin: the configured app URL wins in production, headers only on a laptop', () => {
  const prev = { env: process.env.NODE_ENV, app: process.env.NEXT_PUBLIC_APP_URL };
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.thefutureclips.com/';
  process.env.NODE_ENV = 'production';
  assert.equal(requestOrigin(req('http://evil.internal/x', { host: 'evil.example', 'x-forwarded-host': 'evil.example' })), 'https://app.thefutureclips.com');
  process.env.NODE_ENV = 'development';
  assert.equal(requestOrigin(req('http://localhost:3000/x', { host: 'localhost:3000' })), 'http://localhost:3000');
  process.env.NODE_ENV = prev.env; if (prev.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = prev.app;
});

test('sameOrigin refuses Sec-Fetch-Site: cross-site even without an Origin header', () => {
  assert.equal(sameOrigin(req('https://a.example/x', { host: 'a.example', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(sameOrigin(req('https://a.example/x', { host: 'a.example', 'sec-fetch-site': 'same-origin', origin: 'https://a.example' })), true);
});
