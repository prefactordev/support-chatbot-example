import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createConversationEvaluator } from './conversation-evaluator.ts';
import type { EndChatMessage } from '../end-chat.ts';

const messages: EndChatMessage[] = [
	{ id: '1', role: 'user', parts: [{ type: 'text', text: 'I cannot log in.' }] },
	{ id: '2', role: 'assistant', parts: [{ type: 'text', text: 'I reset your password.' }] }
];

const transcript = 'user: I cannot log in.\n\nassistant: I reset your password.';

test('runs every judge over the transcript and normalizes results', async () => {
	const seen: string[] = [];
	const evaluate = createConversationEvaluator({
		resolution: async (transcript) => {
			seen.push(`resolution:${transcript}`);
			return { label: 'resolved', score: 1, explanation: 'Issue addressed.' };
		},
		helpfulness: async (transcript) => {
			seen.push(`helpfulness:${transcript}`);
			return { label: 'helpful', score: 1 };
		}
	});

	const results = await evaluate(messages);

	assert.deepEqual(results, [
		{ name: 'resolution', verdict: 'resolved', score: 1, explanation: 'Issue addressed.' },
		{ name: 'helpfulness', verdict: 'helpful', score: 1, explanation: '' }
	]);
	assert.equal(seen.length, 2);
	assert.ok(seen.every((call) => call.endsWith(transcript)));
});

test('defaults missing verdict, score, and explanation', async () => {
	const evaluate = createConversationEvaluator({
		only: async () => ({})
	});

	assert.deepEqual(await evaluate(messages), [
		{ name: 'only', verdict: '', score: 0, explanation: '' }
	]);
});

test('keeps fulfilled results when one judge rejects', async () => {
	const evaluate = createConversationEvaluator({
		resolution: async () => ({ label: 'resolved', score: 1, explanation: 'ok' }),
		helpfulness: async () => {
			throw new Error('judge failed');
		}
	});

	assert.deepEqual(await evaluate(messages), [
		{ name: 'resolution', verdict: 'resolved', score: 1, explanation: 'ok' }
	]);
});
