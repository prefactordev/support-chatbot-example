import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = process.cwd();
const forbiddenPatterns = [
	/DEMO_USER/,
	/DEMO_PASS/,
	/ALLOW_UNAUTHENTICATED_LOCAL_DEV/,
	/authHeaders/,
	/basic-auth/,
	/WWW-Authenticate/,
	/Authorization:\s*`Basic/
];

test('the template contains no password-gate implementation or configuration', async () => {
	const files = await collectFiles(['README.md', '.env.example', '.env.test', 'src']);
	const offenders: string[] = [];

	for (const file of files) {
		if (file.endsWith('no-password-gate.test.ts')) continue;
		const contents = await readFile(path.join(repositoryRoot, file), 'utf8');
		if (forbiddenPatterns.some((pattern) => pattern.test(contents))) offenders.push(file);
	}

	assert.deepEqual(offenders, []);
});

async function collectFiles(entries: string[]): Promise<string[]> {
	const files: string[] = [];
	for (const entry of entries) {
		const absolutePath = path.join(repositoryRoot, entry);
		const stats = await import('node:fs/promises').then(({ stat }) => stat(absolutePath));
		if (stats.isFile()) {
			files.push(entry);
			continue;
		}
		for (const child of await readdir(absolutePath, { withFileTypes: true })) {
			const childPath = path.join(entry, child.name);
			if (child.isDirectory()) files.push(...(await collectFiles([childPath])));
			else files.push(childPath);
		}
	}
	return files;
}
