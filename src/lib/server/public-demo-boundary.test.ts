import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const publicFiles = ['package.json', 'README.md', '.env.example'];
const internalArtifacts = [
	'scripts',
	'.env',
	'.env.dev',
	'.env.prod',
	'.git',
	'.desloppify',
	'package-lock.json',
	'src/lib/server/support/simulation-session.ts',
	'src/lib/server/support/simulation-session-registry.ts',
	'src/lib/server/support/support-investigation-simulation.ts'
];

test('getting-started demo has no internal operator tooling or private environments', async () => {
	for (const path of internalArtifacts) {
		await assert.rejects(access(path), `expected ${path} to be absent`);
	}
});

test('public configuration and docs do not expose simulation-only controls', async () => {
	const contents = await Promise.all(publicFiles.map((path) => readFile(path, 'utf8')));
	const combined = contents.join('\n');

	assert.doesNotMatch(
		combined,
		/SUPPORT_SIMULATION_SECRET|simulate:bad-run|simulate:localhost|export:prefactor-spans/
	);
});
