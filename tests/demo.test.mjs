// The demo workspace's fixtures are consistent with what the dashboard needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { demoWorkspaceSets, demoWorkspaceSpecs, demoWorkspaceAccount, demoWorkspaceSet } from '../lib/demo.ts';

const ORG = '0d3e0000-0000-4000-8000-000000000001';

test('every demo set belongs to a demo campaign and every slide file ships under public/demo', () => {
  const specs = new Set(demoWorkspaceSpecs().map((s) => s.id));
  const sets = demoWorkspaceSets(ORG);
  assert.ok(sets.length >= 6, 'at least six example sets');
  for (const s of sets) {
    assert.ok(specs.has(s.campaign_id), `${s.id}: campaign ${s.campaign_id} missing from the demo specs`);
    assert.equal(s.status, 'done');
    assert.equal(s.urls.length, s.slides);
    for (const u of s.urls) {
      assert.ok(u.startsWith('/demo/'), u);
      assert.ok(fs.existsSync(path.join(process.cwd(), 'public', u)), `${u} is not shipped`);
    }
  }
  assert.ok(sets.every((s, i, a) => i === 0 || a[i - 1].created_at >= s.created_at), 'newest first');
});

test('a demo set is found by id and the account is a Clipper plan with the month counted', () => {
  const [first] = demoWorkspaceSets(ORG);
  assert.equal(demoWorkspaceSet(ORG, first.id)?.id, first.id);
  assert.equal(demoWorkspaceSet(ORG, 'demo-nope'), null);
  const a = demoWorkspaceAccount();
  assert.equal(a.plan.id, 'solo');
  assert.equal(a.cap.batch, 200);
  assert.ok(a.usage.slides_used >= 0 && a.usage.slides_used <= 200);
  assert.equal(a.left.batch, 200 - a.usage.slides_used);
});
