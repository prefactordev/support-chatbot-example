import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildTranscript } from './transcript.ts';
import type { EndChatMessage } from '../end-chat.ts';

test('builds a role-tagged transcript in message order', () => {
	const messages: EndChatMessage[] = [
		{ id: '1', role: 'user', parts: [{ type: 'text', text: 'I cannot log in.' }] },
		{ id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Let me check your account.' }] }
	];

	assert.equal(
		buildTranscript(messages),
		'user: I cannot log in.\n\nassistant: Let me check your account.'
	);
});

test('joins multi-part text and ignores non-text parts', () => {
	const messages: EndChatMessage[] = [
		{
			id: '1',
			role: 'assistant',
			parts: [
				{ type: 'text', text: 'Hello' },
				{ type: 'text', text: ' there' },
				{ type: 'tool-call' }
			]
		}
	];

	assert.equal(buildTranscript(messages), 'assistant: Hello there');
});

test('drops messages that have no text content', () => {
	const messages: EndChatMessage[] = [
		{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
		{ id: '2', role: 'assistant', parts: [{ type: 'tool-call' }] },
		{ id: '3', role: 'user', parts: [{ type: 'text', text: 'Thanks' }] }
	];

	assert.equal(buildTranscript(messages), 'user: Hi\n\nuser: Thanks');
});
