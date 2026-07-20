import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createEndChatHandler, createEndChatResponse } from './end-chat.ts';

const messages = [
	{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'How can I help?' }] },
	{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'That solved my billing issue.' }] }
];

test('streams the farewell before completing the Prefactor session', async () => {
	const events: string[] = [];
	const response = createEndChatResponse(
		{ sessionId: 'session-1', messages },
		{
			generateFarewell: async function* (sessionId, _messages) {
				events.push(`generate:${sessionId}`);
				yield 'Thanks for chatting';
				yield ' with us!';
			},
			finishSession: async (sessionId) => {
				events.push(`finish:${sessionId}`);
			}
		}
	);

	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'Thanks for chatting with us!');
	assert.deepEqual(events, ['generate:session-1', 'finish:session-1']);
});

test('completes the Prefactor session when farewell generation fails', async () => {
	const events: string[] = [];
	const response = createEndChatResponse(
		{ sessionId: 'session-1', messages },
		{
			generateFarewell: async function* () {
				throw new Error('model unavailable');
			},
			finishSession: async (sessionId) => {
				events.push(`finish:${sessionId}`);
			}
		}
	);

	assert.equal(response.status, 200);
	assert.equal(await response.text(), '');
	assert.deepEqual(events, ['finish:session-1']);
});

test('rejects invalid requests without completing a session', async () => {
	let finished = false;
	const handler = createEndChatHandler({
		generateFarewell: async function* () {
			yield 'unused';
		},
		finishSession: async () => {
			finished = true;
		}
	});
	const response = await handler(
		new Request('http://localhost/api/chat/end', {
			method: 'POST',
			body: JSON.stringify({ sessionId: '', messages: [] })
		})
	);

	assert.equal(response.status, 400);
	assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
	assert.deepEqual(await response.json(), { error: 'sessionId is required' });
	assert.equal(finished, false);
});

test('the HTTP handler rejects malformed JSON without invoking dependencies', async () => {
	let invoked = false;
	const handler = createEndChatHandler({
		generateFarewell: async function* () {
			invoked = true;
			yield 'unused';
		},
		finishSession: async () => {
			invoked = true;
		}
	});

	const response = await handler(
		new Request('http://localhost/api/chat/end', { method: 'POST', body: '{' })
	);

	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), { error: 'Invalid request' });
	assert.equal(invoked, false);
});
