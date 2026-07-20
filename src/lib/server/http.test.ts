import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseJsonRequest } from './http.ts';

test('parses and validates a JSON request', async () => {
	const request = new Request('http://localhost/api/example', {
		method: 'POST',
		body: JSON.stringify({ name: 'Ada' })
	});

	const result = await parseJsonRequest(request, (body) => {
		if (typeof body !== 'object' || body === null || !('name' in body)) {
			throw new Error('name is required');
		}
		return body as { name: string };
	});

	assert.deepEqual(result, { name: 'Ada' });
});

test('returns a consistent JSON error for malformed JSON', async () => {
	const request = new Request('http://localhost/api/example', {
		method: 'POST',
		body: '{'
	});

	const result = await parseJsonRequest(request, (body) => body);

	assert.ok(result instanceof Response);
	assert.equal(result.status, 400);
	assert.deepEqual(await result.json(), { error: 'Invalid request' });
});

test('uses the validation error formatter for invalid payloads', async () => {
	const request = new Request('http://localhost/api/example', {
		method: 'POST',
		body: '{}'
	});

	const result = await parseJsonRequest(
		request,
		() => {
			throw new Error('name is required');
		},
		(error) => (error instanceof Error ? error.message : 'Invalid request')
	);

	assert.ok(result instanceof Response);
	assert.deepEqual(await result.json(), { error: 'name is required' });
});
