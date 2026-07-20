import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSupportSessionCleanup } from './support-session-lifecycle.ts';

test('session cleanup drains background jobs', async () => {
	const events: string[] = [];
	const cleanup = createSupportSessionCleanup({
		cleanupJobs: async (sessionId) => {
			events.push(`jobs:${sessionId}`);
		}
	});
	await cleanup('session-1');
	assert.deepEqual(events, ['jobs:session-1']);
});
