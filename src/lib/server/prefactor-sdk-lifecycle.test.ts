import assert from 'node:assert/strict';
import test from 'node:test';
import { createRegistrationGuard } from './prefactor-sdk-lifecycle.ts';

test('registration guard starts once and synchronizes the middleware lifecycle', () => {
	const provider = { agentLifecycle: { started: false } };
	let starts = 0;
	const ensureRegistered = createRegistrationGuard(provider, () => {
		starts += 1;
	});

	ensureRegistered();
	ensureRegistered();

	assert.equal(starts, 1);
	assert.equal(provider.agentLifecycle.started, true);
});

test('registration guard respects middleware registration that already happened', () => {
	const provider = { agentLifecycle: { started: true } };
	let starts = 0;
	createRegistrationGuard(provider, () => {
		starts += 1;
	})();

	assert.equal(starts, 0);
});
