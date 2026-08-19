import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createEvaluationRecorder } from './record-evaluation.ts';
import type { ConversationEvaluation } from './conversation-evaluator.ts';
import type { EndChatMessage } from '../end-chat.ts';

const messages: EndChatMessage[] = [
	{ id: '1', role: 'user', parts: [{ type: 'text', text: 'I cannot log in.' }] },
	{ id: '2', role: 'assistant', parts: [{ type: 'text', text: 'I reset your password.' }] }
];

const results: ConversationEvaluation[] = [
	{ name: 'resolution', verdict: 'resolved', score: 1, explanation: 'Issue addressed.' },
	{ name: 'helpfulness', verdict: 'helpful', score: 1, explanation: 'Clear steps.' }
];

test('submits one quality payload per evaluation dimension', async () => {
	const submitted: Array<{
		sessionId: string;
		name: string;
		qualityPayload: Record<string, unknown>;
	}> = [];
	const record = createEvaluationRecorder({
		evaluate: async (received) => {
			assert.equal(received, messages);
			return results;
		},
		submitQuality: (sessionId, name, qualityPayload) => {
			submitted.push({ sessionId, name, qualityPayload });
		}
	});

	await record('session-1', messages);

	assert.deepEqual(submitted, [
		{
			sessionId: 'session-1',
			name: 'resolution',
			qualityPayload: {
				score: 1,
				verdict: 'resolved',
				explanation: 'Issue addressed.'
			}
		},
		{
			sessionId: 'session-1',
			name: 'helpfulness',
			qualityPayload: {
				score: 1,
				verdict: 'helpful',
				explanation: 'Clear steps.'
			}
		}
	]);
});
