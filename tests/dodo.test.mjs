// The webhook signature check (Standard Webhooks) and the product map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { verifyWebhook, productMap, skuFor } from '../lib/billing/dodo.ts';

const secretRaw = randomBytes(24);
process.env.DODO_WEBHOOK_SECRET = `whsec_${secretRaw.toString('base64')}`;
process.env.DODO_PRODUCTS = 'solo=pdt_1, grind=pdt_2,agency=pdt_3,p100=pdt_4';

const sign = (id, ts, body, key = secretRaw) => 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
const headers = (id, ts, sig) => new Headers({ 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sig });
const body = JSON.stringify({ type: 'payment.succeeded', data: { metadata: { org_id: 'x' } } });

test('a correctly signed, fresh delivery verifies and parses', () => {
  const ts = Math.floor(Date.now() / 1000);
  const r = verifyWebhook(headers('msg_1', ts, sign('msg_1', ts, body)), body);
  assert.equal(r.id, 'msg_1');
  assert.equal(r.event.type, 'payment.succeeded');
});

test('several signatures in the header: any valid v1 one passes', () => {
  const ts = Math.floor(Date.now() / 1000);
  const sig = 'v1,AAAA ' + sign('msg_2', ts, body) + ' v2,BBBB';
  assert.equal(verifyWebhook(headers('msg_2', ts, sig), body).id, 'msg_2');
});

test('a tampered body, a wrong key, a stale timestamp and missing headers all refuse', () => {
  const ts = Math.floor(Date.now() / 1000);
  assert.throws(() => verifyWebhook(headers('msg_3', ts, sign('msg_3', ts, body)), body + ' '), /mismatch/);
  assert.throws(() => verifyWebhook(headers('msg_3', ts, sign('msg_3', ts, body, randomBytes(24))), body), /mismatch/);
  const old = ts - 6 * 60;
  assert.throws(() => verifyWebhook(headers('msg_3', old, sign('msg_3', old, body)), body), /tolerance/);
  assert.throws(() => verifyWebhook(new Headers({ 'webhook-id': 'msg_3' }), body), /missing/);
});

test('the product map reads DODO_PRODUCTS both ways', () => {
  assert.deepEqual(productMap(), { solo: 'pdt_1', grind: 'pdt_2', agency: 'pdt_3', p100: 'pdt_4' });
  assert.equal(skuFor('pdt_2'), 'grind');
  assert.equal(skuFor('pdt_nope'), null);
});
