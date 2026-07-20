import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = join(projectRoot, 'src');
const canonicalSchema = join(sourceRoot, 'lib/server/prefactor-schemas/span-types.json');

test('Prefactor schemas are owned by production code', async () => {
	await access(canonicalSchema);
});

test('AI SDK span templates address literal dotted telemetry keys', async () => {
	const schemas = JSON.parse(await readFile(canonicalSchema, 'utf8')) as Array<{
		name: string;
		template?: string;
	}>;
	const llmTemplate = schemas.find((schema) => schema.name === 'ai-sdk:llm')?.template ?? '';
	const toolTemplate = schemas.find((schema) => schema.name === 'ai-sdk:tool')?.template ?? '';

	assert.match(llmTemplate, /inputs\["ai\.prompt"\]/);
	assert.match(llmTemplate, /outputs\["ai\.response\.text"\]/);
	assert.match(toolTemplate, /inputs\["ai\.tool\.name"\]/);
	assert.match(toolTemplate, /outputs\.output\.value\.label/);
});
