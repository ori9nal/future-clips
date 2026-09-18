import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearerMatches } from '../lib/secrets.ts';

test('bearerMatches accepts the exact bearer and refuses everything else', () => {
  assert.equal(bearerMatches('Bearer s3cret', 's3cret'), true);
  assert.equal(bearerMatches('Bearer s3cre', 's3cret'), false);
  assert.equal(bearerMatches('Bearer s3cret ', 's3cret'), false);
  assert.equal(bearerMatches('s3cret', 's3cret'), false);
  assert.equal(bearerMatches('', 's3cret'), false);
  assert.equal(bearerMatches('Bearer ', ''), false);
});
