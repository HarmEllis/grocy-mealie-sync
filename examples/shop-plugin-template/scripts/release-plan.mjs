import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releasePlan(tag, repository) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(tag);
  if (!match || tag.length > 128 || match[4]?.split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) {
    throw new Error('Expected a Docker-compatible semver tag, e.g. v1.2.3 or v1.2.3-rc.1 (no build metadata).');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository name.');
  const image = `ghcr.io/${repository.toLowerCase()}`;
  const version = tag.slice(1);
  const prerelease = Boolean(match[4]);
  return { version, image, prerelease, tags: [version, ...(prerelease ? [] : ['latest', match[1], `${match[1]}.${match[2]}`])].map(value => `${image}:${value}`) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = releasePlan(process.argv[2], process.argv[3]);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  if (pkg.version !== plan.version) throw new Error(`package.json version ${pkg.version} does not match ${plan.version}.`);
  console.log(`prerelease=${plan.prerelease}`);
  console.log(`image=${plan.image}`);
  console.log(`tags<<RELEASE_TAGS\n${plan.tags.join('\n')}\nRELEASE_TAGS`);
}
