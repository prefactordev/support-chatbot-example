import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('new and first-run sessions contain no pre-seeded messages', async () => {
	const storeSource = await readFile(new URL('../stores.svelte.ts', import.meta.url), 'utf8');

	assert.doesNotMatch(storeSource, /WELCOME_MESSAGE|createWelcomeSession/);
	assert.match(storeSource, /messages:\s*\[\]/);
});
