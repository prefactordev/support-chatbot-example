import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SupportJobRegistry } from './support-jobs.ts';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
}

function nextTurn() {
	return new Promise<void>((resolve) => setImmediate(resolve));
}

test('runs multiple support jobs concurrently and emits separate completion events', async () => {
	const registry = new SupportJobRegistry();
	const events: string[] = [];
	const firstRun = deferred<string>();
	const completed = deferred<void>();
	const unsubscribe = registry.subscribe('session-1', (event) => {
		if (event.status === 'completed') events.push(event.message.content);
		if (events.length === 2) completed.resolve();
	});

	registry.start({
		sessionId: 'session-1',
		issueType: 'feature_access',
		userRequest: 'I cannot access analytics',
		run: () => firstRun.promise
	});
	registry.start({
		sessionId: 'session-1',
		issueType: 'billing',
		userRequest: 'I need my invoice',
		run: async () => 'Invoice details need a quick verification first.'
	});

	firstRun.resolve('Analytics access is limited by workspace role.');
	await completed.promise;
	unsubscribe();

	assert.equal(events.length, 2);
	assert.match(events.join('\n'), /Analytics access/);
	assert.match(events.join('\n'), /Invoice details/);
});

test('emits timestamped status events without duplicating completed answer excerpts', async () => {
	const registry = new SupportJobRegistry();
	const events: { status: string; createdAt: number; excerpt?: string }[] = [];
	const completed = deferred<void>();
	registry.subscribe('session-1', (event) => {
		events.push(event);
		if (event.status === 'completed') completed.resolve();
	});

	registry.start({
		sessionId: 'session-1',
		issueType: 'account_access',
		userRequest: 'What is my account status?',
		run: async () => 'Your account is active.'
	});

	await completed.promise;

	assert.deepEqual(
		events.map((event) => event.status),
		['started', 'completed']
	);
	assert.ok(events.every((event) => Number.isFinite(event.createdAt)));
	assert.equal(events[1]?.excerpt, undefined);
});

test('reuses an existing matching job instead of publishing duplicate activity', async () => {
	const registry = new SupportJobRegistry();
	const events: string[] = [];
	const completed = deferred<void>();
	registry.subscribe('session-1', (event) => {
		events.push(event.status);
		if (event.status === 'completed') completed.resolve();
	});

	const first = registry.start({
		sessionId: 'session-1',
		issueType: 'feature_access',
		userRequest: 'I cannot access analytics',
		run: async () => 'Analytics access is limited by workspace role.'
	});
	const second = registry.start({
		sessionId: 'session-1',
		issueType: 'feature_access',
		userRequest: '  I cannot access   analytics  ',
		run: async () => {
			throw new Error('duplicate run should not start');
		}
	});

	await completed.promise;

	assert.equal(second.id, first.id);
	assert.equal(second.reused, true);
	assert.deepEqual(events, ['started', 'completed']);
});

test('does not deliver another session events to a subscriber', async () => {
	const registry = new SupportJobRegistry();
	const events: string[] = [];
	registry.subscribe('session-1', (event) => events.push(event.jobId));

	registry.start({
		sessionId: 'session-2',
		issueType: 'permissions',
		userRequest: 'What is my role?',
		run: async () => 'Different session.'
	});

	await nextTurn();

	assert.deepEqual(events, []);
});

test('replays bounded session events to late and reconnecting subscribers', async () => {
	let id = 0;
	const registry = new SupportJobRegistry({ maxEventsPerSession: 2, createId: () => `id-${++id}` });
	registry.start({
		sessionId: 'session-1',
		issueType: 'billing',
		userRequest: 'invoice',
		run: async () => 'done'
	});
	await nextTurn();

	const replayed: string[] = [];
	registry.subscribe('session-1', (event) => replayed.push(event.id));
	assert.deepEqual(replayed, ['id-1:started', 'id-1:completed']);

	const resumed: string[] = [];
	registry.subscribe('session-1', (event) => resumed.push(event.id), {
		afterEventId: 'id-1:started'
	});
	assert.deepEqual(resumed, ['id-1:completed']);
});

test('reuses a completed result only during the dedupe TTL and replays its result', async () => {
	let now = 100;
	let runs = 0;
	const registry = new SupportJobRegistry({ now: () => now, dedupeTtlMs: 50 });
	const start = () =>
		registry.start({
			sessionId: 'session-1',
			issueType: 'billing',
			userRequest: 'invoice',
			run: async () => `result-${++runs}`
		});
	start();
	await nextTurn();
	const reused = start();
	assert.equal(reused.reused, true);
	await nextTurn();
	const messages: string[] = [];
	registry.subscribe('session-1', (event) => {
		if (event.status === 'completed') messages.push(event.message.content);
	});
	assert.deepEqual(messages, ['result-1']);

	now = 151;
	const fresh = start();
	assert.equal(fresh.reused, false);
	await nextTurn();
	assert.equal(runs, 2);
});

test('reports original failures with context while publishing a sanitized message', async () => {
	const failure = new Error('database password leaked');
	const reports: unknown[] = [];
	const registry = new SupportJobRegistry({
		reportError: (error, context) => reports.push({ error, context })
	});
	const events: Array<{ status: string; excerpt?: string; message?: { content: string } }> = [];
	registry.subscribe('session-1', (event) => events.push(event));
	registry.start({
		sessionId: 'session-1',
		issueType: 'security',
		userRequest: 'check MFA',
		run: async () => {
			throw failure;
		}
	});
	await nextTurn();

	assert.equal((reports[0] as { error: unknown }).error, failure);
	assert.deepEqual((reports[0] as { context: unknown }).context, {
		jobId: (reports[0] as { context: { jobId: string } }).context.jobId,
		sessionId: 'session-1',
		issueType: 'security'
	});
	assert.equal(events.at(-1)?.excerpt, 'Support investigation failed');
	assert.doesNotMatch(events.at(-1)?.message?.content ?? '', /password/);
});

test('cleanup waits for running work and then removes retained session state', async () => {
	const run = deferred<string>();
	const registry = new SupportJobRegistry();
	registry.start({
		sessionId: 'session-1',
		issueType: 'billing',
		userRequest: 'invoice',
		run: () => run.promise
	});
	const cleanup = registry.cleanupSession('session-1');
	let completed = false;
	void cleanup.then(() => (completed = true));
	await nextTurn();
	assert.equal(completed, false);
	run.resolve('done');
	await cleanup;
	const replayed: string[] = [];
	registry.subscribe('session-1', (event) => replayed.push(event.id));
	assert.deepEqual(replayed, []);
});

test('expires terminal session state after the retention TTL', async () => {
	let now = 0;
	const registry = new SupportJobRegistry({ now: () => now, retentionTtlMs: 50 });
	registry.start({
		sessionId: 'session-1',
		issueType: 'billing',
		userRequest: 'invoice',
		run: async () => 'done'
	});
	await nextTurn();
	now = 51;
	const replayed: string[] = [];
	registry.subscribe('session-1', (event) => replayed.push(event.id));
	assert.deepEqual(replayed, []);
});
