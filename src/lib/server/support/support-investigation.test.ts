import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	createSupportInvestigationLinkTraceOptions,
	createSupportInvestigationRunner,
	createSupportInvestigationTraceOptions
} from './support-investigation-runner.ts';
import { stripStandaloneChatOpening } from './support-text.ts';

test('removes standalone greetings from support updates', () => {
	assert.equal(
		stripStandaloneChatOpening(
			'Hi Maya,\n\nFor analytics access, you need a Reporting Admin role.'
		),
		'For analytics access, you need a Reporting Admin role.'
	);
});

test('runs a support investigation and links its Prefactor instance', async () => {
	const calls: string[] = [];
	const run = createSupportInvestigationRunner({
		delay: async (milliseconds) => void calls.push(`delay:${milliseconds}`),
		investigationDelay: () => 42,
		generate: async () => {
			calls.push('generate');
			return 'Investigation complete.';
		},
		waitForAgentInstanceId: async (getAgentInstanceId) => getAgentInstanceId(),
		linkSubagentInstance: async ({ subagentAgentInstanceId }) => {
			calls.push(`link:${subagentAgentInstanceId}`);
		},
		withRuntime: async (_sessionId, callback) =>
			callback({
				middleware: undefined,
				traceSensitive: async (_options, fn) => fn(),
				getAgentInstanceId: () => 'support-instance-1'
			})
	});

	const result = await run({
		sessionId: 'session-1',
		issueType: 'feature_access',
		userRequest: 'Can I use analytics?'
	});

	assert.equal(result, 'Investigation complete.');
	assert.deepEqual(calls, ['delay:42', 'generate', 'link:support-instance-1']);
});

test('trace options retain issue and linked instance identity', () => {
	const normal = createSupportInvestigationTraceOptions({
		sessionId: 'session-1',
		issueType: 'billing',
		userRequest: 'Where is my invoice?'
	});
	const link = createSupportInvestigationLinkTraceOptions({
		sessionId: 'session-1',
		issueType: 'billing',
		subagentAgentInstanceId: 'support-instance-1',
		resultPreview: 'Invoice located.'
	});

	assert.equal(normal.name, 'chatbot:support-subagent:billing');
	assert.equal(link.name, 'chatbot:support-subagent-link:billing');
	assert.equal(
		(link.inputs.support as Record<string, unknown>).subagent_agent_instance_id,
		'support-instance-1'
	);
});
