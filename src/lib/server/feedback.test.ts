import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFeedbackHandler } from './feedback-handler.ts';
import { parseFeedbackRequest } from './request-schemas.ts';

test('normalizes assistant message feedback metadata for Prefactor', () => {
	const payload = parseFeedbackRequest({
		sessionId: 'session-123',
		messageId: 'msg-456',
		messageContent: 'I checked your workspace permissions.',
		feedback: 'down',
		reasons: ['incomplete', 42, 'unclear'],
		comment: 'Needs more detail.',
		sessionName: 'Analytics access',
		messageCount: 4
	});

	assert.deepEqual(payload, {
		sessionId: 'session-123',
		messageId: 'msg-456',
		messageContent: 'I checked your workspace permissions.',
		feedback: 'down',
		reasons: ['incomplete', 'unclear'],
		comment: 'Needs more detail.',
		sessionName: 'Analytics access',
		messageCount: 4
	});
});

test('rejects feedback without an assistant message id', () => {
	assert.throws(
		() =>
			parseFeedbackRequest({
				sessionId: 'session-123',
				feedback: 'up'
			}),
		/messageId is required/
	);
});

test('the feedback HTTP handler validates and records a normalized payload', async () => {
	const recorded: unknown[] = [];
	const handler = createFeedbackHandler(async (payload) => {
		recorded.push(payload);
	});
	const response = await handler(
		new Request('http://localhost/api/feedback', {
			method: 'POST',
			body: JSON.stringify({
				sessionId: 'session-123',
				messageId: 'message-456',
				feedback: 'up',
				reasons: ['clear', 42]
			})
		})
	);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { ok: true });
	assert.deepEqual(recorded, [
		{
			sessionId: 'session-123',
			messageId: 'message-456',
			messageContent: '',
			feedback: 'up',
			reasons: ['clear']
		}
	]);
});

test('the feedback HTTP handler rejects malformed JSON without recording feedback', async () => {
	let recorded = false;
	const handler = createFeedbackHandler(async () => {
		recorded = true;
	});

	const response = await handler(
		new Request('http://localhost/api/feedback', { method: 'POST', body: '{' })
	);

	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), { error: 'Invalid request' });
	assert.equal(recorded, false);
});
