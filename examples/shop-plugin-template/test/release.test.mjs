import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releasePlan } from '../scripts/release-plan.mjs';

test('stable releases own exact and moving tags', () => {
  assert.deepEqual(releasePlan('v1.2.3', 'Owner/Plugin').tags, ['ghcr.io/owner/plugin:1.2.3', 'ghcr.io/owner/plugin:latest', 'ghcr.io/owner/plugin:1', 'ghcr.io/owner/plugin:1.2']);
});
test('every prerelease owns only its exact version', () => {
  for (const suffix of ['rc.1', 'beta.2', 'alpha.1', 'preview-test']) {
    const plan = releasePlan(`v1.2.3-${suffix}`, 'Owner/Plugin');
    assert.equal(plan.prerelease, true);
    assert.deepEqual(plan.tags, [`ghcr.io/owner/plugin:1.2.3-${suffix}`]);
  }
});
test('invalid semver and Docker-incompatible tags are refused', () => {
  for (const tag of ['1.2.3', 'v01.2.3', 'v1.2.3-01', 'v1.2.3+meta', 'v1.2.3-', 'v1.2.3-rc..1', 'v1.2.3-foo\nbar']) {
    assert.throws(() => releasePlan(tag, 'Owner/Plugin'));
  }
});
