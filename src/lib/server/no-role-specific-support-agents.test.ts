import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const forbiddenPatterns = [
	/SupportSubagentRole/,
	/prefactorRoleForIssue/,
	/PREFACTOR_(?:AGENT_ID|API_TOKEN|AGENT_IDENTIFIER)_SUPPORT_(?:ACCOUNT|ACCESS|BILLING|SECURITY)/,
	/\bsubagentRole\b/,
	/\bsubagent_role\b/
];

async function productionFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const filePath = path.join(directory, entry.name);
			if (entry.isDirectory()) return productionFiles(filePath);
			if (!/\.(?:ts|js|svelte|json)$/.test(entry.name) || entry.name.endsWith('.test.ts'))
				return [];
			return [filePath];
		})
	);
	return files.flat();
}

test('production source has no role-specific support agent coupling', async () => {
	const sourceDirectory = path.resolve('src');
	const violations: string[] = [];

	for (const filePath of await productionFiles(sourceDirectory)) {
		const source = await readFile(filePath, 'utf8');
		for (const pattern of forbiddenPatterns) {
			if (pattern.test(source))
				violations.push(`${path.relative(sourceDirectory, filePath)}: ${pattern}`);
		}
	}

	assert.deepEqual(violations, []);
});
