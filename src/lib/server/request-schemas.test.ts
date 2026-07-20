import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChatRequest, parseEndChatRequest, parseFeedbackRequest } from './request-schemas.ts';

test('parses a streaming chat request', () => {
	const result = parseChatRequest({
		sessionId: 'session-1',
		messages: [{ id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }]
	});

	assert.equal(result.sessionId, 'session-1');
	assert.equal(result.messages.length, 1);
});

test('rejects a chat request without messages', () => {
	assert.throws(() => parseChatRequest({ sessionId: 'session-1', messages: [] }), /messages/);
});

test('normalizes bounded feedback fields', () => {
	const result = parseFeedbackRequest({
		sessionId: 'session-1',
		messageId: 'message-1',
		feedback: 'up',
		messageContent: 'x'.repeat(5000),
		comment: '  useful  ',
		reasons: ['clear', 42]
	});

	assert.equal(result.messageContent.length, 4000);
	assert.equal(result.comment, 'useful');
	assert.deepEqual(result.reasons, ['clear']);
});

test('parses a valid end-chat request', () => {
	const result = parseEndChatRequest({
		sessionId: 'session-1',
		messages: [{ id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'Bye' }] }]
	});

	assert.equal(result.sessionId, 'session-1');
});
