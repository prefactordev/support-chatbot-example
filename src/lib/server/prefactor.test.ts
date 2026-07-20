import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpanContext, SpanStatus, type Span } from '@prefactor/core';

import { parseServerConfig } from './config.ts';
import {
	createPrefactorSessionRegistry,
	createWithSupportSubagentRuntime
} from './prefactor-session-registry.ts';

type SelectableRuntime = {
	id: string;
	finishRun: () => Promise<void>;
};

const requiredEnv = {
	ANTHROPIC_API_KEY: 'anthropic-key',
	PREFACTOR_API_URL: 'https://api.prefactor.ai',
	PREFACTOR_API_TOKEN: 'prefactor-token',
	PREFACTOR_AGENT_ID: 'agent-id'
};

function testSpan(spanId: string, parentSpanId: string | null = null): Span {
	return {
		spanId,
		parentSpanId,
		traceId: 'foreground-trace',
		name: spanId,
		spanType: 'test',
		startTime: Date.now(),
		endTime: null,
		status: SpanStatus.RUNNING,
		inputs: {},
		outputs: null,
		tokenUsage: null,
		error: null,
		metadata: {}
	};
}

test('configured support dispatch runs without the foreground parent and restores it afterward', async () => {
	const foregroundSpan = testSpan('foreground-span');
	const nestedForegroundSpan = testSpan('nested-foreground-span', foregroundSpan.spanId);
	const contextStacks: Array<ReturnType<typeof SpanContext.getStack>> = [];
	const withRuntime = createWithSupportSubagentRuntime({
		createSupportRuntime: () => ({
			id: 'generic-support',
			finishRun: async () => {
				contextStacks.push(SpanContext.getStack());
			}
		}),
		acquireMainRuntime: () => {
			throw new Error('main runtime should not be selected');
		}
	});

	await SpanContext.runAsync(foregroundSpan, async () => {
		await SpanContext.runAsync(nestedForegroundSpan, async () => {
			assert.deepEqual(SpanContext.getStack(), [foregroundSpan, nestedForegroundSpan]);
			await withRuntime('session-1', async () => {
				contextStacks.push(SpanContext.getStack());
				await Promise.resolve();
				contextStacks.push(SpanContext.getStack());
			});
			assert.deepEqual(SpanContext.getStack(), [foregroundSpan, nestedForegroundSpan]);
		});
		assert.equal(SpanContext.getCurrent(), foregroundSpan);
	});

	assert.deepEqual(contextStacks, [[], [], []]);
});

test('uses the same generic support runtime choice for every support issue type', async () => {
	const config = parseServerConfig({
		...requiredEnv,
		PREFACTOR_AGENT_ID_SUPPORT: 'support-agent',
		PREFACTOR_API_TOKEN_SUPPORT: 'support-token'
	});
	let finishCount = 0;
	const supportRuntime: SelectableRuntime = {
		id: 'generic-support',
		finishRun: async () => {
			finishCount++;
		}
	};
	const withRuntime = createWithSupportSubagentRuntime({
		createSupportRuntime: () => (config.supportAgent ? supportRuntime : undefined),
		acquireMainRuntime: () => {
			throw new Error('main runtime should not be selected');
		}
	});

	const issueTypes = [
		'account_access',
		'billing',
		'feature_access',
		'permissions',
		'security',
		'subscription',
		'general'
	];
	for (const issueType of issueTypes) {
		const selected = await withRuntime('session-1', (runtime) => ({ issueType, runtime }));
		assert.equal(selected.runtime, supportRuntime);
	}

	assert.equal(finishCount, issueTypes.length);
});

test('absent or incomplete support config falls back to the matching main session runtime', async () => {
	const incompleteEnvironments = [
		requiredEnv,
		{ ...requiredEnv, PREFACTOR_AGENT_ID_SUPPORT: 'support-agent' },
		{ ...requiredEnv, PREFACTOR_API_TOKEN_SUPPORT: 'support-token' }
	];

	for (const environment of incompleteEnvironments) {
		const config = parseServerConfig(environment);
		const mainRuntimes = new Map<string, SelectableRuntime>();
		const acquireMainRuntime = (sessionId: string) => {
			let runtime = mainRuntimes.get(sessionId);
			if (!runtime) {
				runtime = { id: `main:${sessionId}`, finishRun: async () => {} };
				mainRuntimes.set(sessionId, runtime);
			}
			return runtime;
		};
		const withRuntime = createWithSupportSubagentRuntime({
			createSupportRuntime: () =>
				config.supportAgent ? { id: 'generic-support', finishRun: async () => {} } : undefined,
			acquireMainRuntime
		});

		const billingRuntime = await withRuntime('session-1', (runtime) => runtime);
		const securityRuntime = await withRuntime('session-1', (runtime) => runtime);
		const otherSessionRuntime = await withRuntime('session-2', (runtime) => runtime);

		assert.equal(billingRuntime, acquireMainRuntime('session-1'));
		assert.equal(securityRuntime, billingRuntime);
		assert.equal(otherSessionRuntime, acquireMainRuntime('session-2'));
		assert.notEqual(otherSessionRuntime, billingRuntime);
	}
});

test('reuses a Prefactor runtime for multiple messages in the same chat session', async () => {
	const events: string[] = [];
	let runtimeCount = 0;

	const registry = createPrefactorSessionRegistry(() => {
		const id = `runtime-${++runtimeCount}`;
		return {
			middleware: { id },
			trace: async (_options, fn) => fn(),
			traceSensitive: async (_options, fn) => fn(),
			chatStream: async (_options, fn) => fn(() => events.push(`end:${id}`)),
			getAgentInstanceId: () => id,
			finishRun: async () => {
				events.push(`finish:${id}`);
			}
		};
	});

	const first = registry.acquire('session-a');
	const second = registry.acquire('session-a');
	const other = registry.acquire('session-b');

	assert.equal(first, second);
	assert.notEqual(first, other);
	assert.equal(runtimeCount, 2);

	await registry.chatStream(
		'session-a',
		{ name: 'chatbot:chat', spanType: 'chatbot:chat', inputs: {} },
		async (end) => {
			end('completed');
			return 'ok';
		}
	);

	assert.deepEqual(events, ['end:runtime-1']);
	assert.equal(registry.acquire('session-a'), first);
});

test('finish waits for Prefactor shutdown and evicts only the completed session', async () => {
	const shutdownResolvers = new Map<string, () => void>();
	const finished: string[] = [];
	let runtimeCount = 0;
	const registry = createPrefactorSessionRegistry(() => {
		const id = `runtime-${++runtimeCount}`;
		return {
			middleware: { id },
			trace: async (_options, fn) => fn(),
			traceSensitive: async (_options, fn) => fn(),
			chatStream: async (_options, fn) => fn(() => undefined),
			getAgentInstanceId: () => id,
			finishRun: () =>
				new Promise<void>((resolve) => {
					shutdownResolvers.set(id, () => {
						finished.push(id);
						resolve();
					});
				})
		};
	});

	const completed = registry.acquire('completed');
	const active = registry.acquire('active');
	let settled = false;
	const finishing = registry.finish('completed').then(() => {
		settled = true;
	});

	await Promise.resolve();
	assert.equal(settled, false);
	shutdownResolvers.get('runtime-1')?.();
	await finishing;

	assert.deepEqual(finished, ['runtime-1']);
	assert.notEqual(registry.acquire('completed'), completed);
	assert.equal(registry.acquire('active'), active);
});

test('prune awaits idle runtime shutdown before removing it', async () => {
	let now = 0;
	let shutdownComplete = false;
	let releaseShutdown: () => void = () => undefined;
	const registry = createPrefactorSessionRegistry(
		() => ({
			middleware: {},
			trace: async (_options, fn) => fn(),
			traceSensitive: async (_options, fn) => fn(),
			chatStream: async (_options, fn) => fn(() => undefined),
			getAgentInstanceId: () => null,
			finishRun: () =>
				new Promise<void>((resolve) => {
					releaseShutdown = () => {
						shutdownComplete = true;
						resolve();
					};
				})
		}),
		{ idleTtlMs: 10, now: () => now }
	);

	registry.acquire('idle-session');
	now = 11;
	let settled = false;
	const pruning = registry.prune().then(() => {
		settled = true;
	});
	await Promise.resolve();
	assert.equal(settled, false);
	releaseShutdown();
	await pruning;

	assert.equal(shutdownComplete, true);
});
