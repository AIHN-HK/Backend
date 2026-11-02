import assert = require('node:assert/strict');
import { spawnSync } from 'node:child_process';
import { LocalBackendFixture } from './support/local-backend-fixture';

async function main() {
  const image = process.env.AIHN_TEST_IMAGE || 'aihn-backend:technical-local';
  const version = spawnSync(
    'docker',
    ['run', '--rm', image, 'node', '--version'],
    { encoding: 'utf8', timeout: 20000 },
  );
  assert.equal(version.status, 0, 'Built image missing');
  assert.match(version.stdout.trim(), /^v24\./);
  const fixture = new LocalBackendFixture(image);
  try {
    await fixture.start();
    assert.equal(
      (
        await fetch(fixture.origin + '/api/v1/health/ready', {
          signal: AbortSignal.timeout(5000),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(fixture.origin + '/api/v1/users/me', {
          signal: AbortSignal.timeout(5000),
        })
      ).status,
      401,
    );
    console.log(
      'PASS Docker production dependencies, migration and ready/private HTTP:',
      version.stdout.trim(),
    );
  } finally {
    await fixture.stop();
  }
  console.log(
    'PASS owned Docker app SIGTERM/cleanup; isolated DB/Redis removed.',
  );
}
main().catch((error) => {
  console.error('Docker fixture failed', {
    name: error.name,
    message: error.message,
  });
  process.exitCode = 1;
});
