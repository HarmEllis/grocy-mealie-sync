import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const composePath = resolve(repoRoot, 'compose-dev.yml');

const targets = [
  {
    name: 'Grocy',
    service: 'grocy',
    imageRepository: 'lscr.io/linuxserver/grocy',
    githubOwner: 'grocy',
    githubRepo: 'grocy',
    toImageTag(tag) {
      return tag.replace(/^v/, '');
    },
  },
  {
    name: 'Mealie',
    service: 'mealie',
    imageRepository: 'ghcr.io/mealie-recipes/mealie',
    githubOwner: 'mealie-recipes',
    githubRepo: 'mealie',
    toImageTag(tag) {
      return tag.startsWith('v') ? tag : `v${tag}`;
    },
  },
];

async function fetchLatestRelease(target) {
  const url = `https://api.github.com/repos/${target.githubOwner}/${target.githubRepo}/releases/latest`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'grocy-mealie-sync-compose-dev-updater',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest ${target.name} release: ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  if (!release.tag_name) {
    throw new Error(`GitHub did not return a release tag for ${target.name}`);
  }

  return release;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${details}`);
  }
}

function updateServiceImage(composeContent, serviceName, newImage) {
  const lines = composeContent.split(/\r?\n/);
  let currentTopLevel = null;
  let currentService = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const topLevelMatch = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (topLevelMatch) {
      currentTopLevel = topLevelMatch[1];
      currentService = null;
      continue;
    }

    if (currentTopLevel !== 'services') {
      continue;
    }

    const serviceMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (serviceMatch) {
      currentService = serviceMatch[1];
      continue;
    }

    if (currentService === serviceName && /^    image:\s*/.test(line)) {
      lines[index] = `    image: ${newImage}`;
      return lines.join('\n');
    }
  }

  throw new Error(`Could not find image line for service "${serviceName}" in ${composePath}`);
}

const originalComposeContent = await readFile(composePath, 'utf8');
let composeContent = originalComposeContent;

for (const target of targets) {
  const release = await fetchLatestRelease(target);
  const imageTag = target.toImageTag(release.tag_name);
  const imageReference = `${target.imageRepository}:${imageTag}`;

  run('docker', ['manifest', 'inspect', imageReference]);

  composeContent = updateServiceImage(composeContent, target.service, imageReference);
  console.log(`${target.name}: ${release.tag_name} (${release.published_at}) -> ${imageReference}`);
}

if (composeContent === originalComposeContent) {
  console.log(`${composePath} is already up to date`);
} else {
  await writeFile(composePath, composeContent);
  console.log(`Updated ${composePath}`);
}
