import assert from 'node:assert/strict';
import test from 'node:test';
import { createServerConfigProvider } from './server-config-provider.ts';

const environment = {
	ANTHROPIC_API_KEY: 'anthropic-key',
	PREFACTOR_API_URL: 'https://api.prefactor.ai',
	PREFACTOR_API_TOKEN: 'prefactor-token',
	PREFACTOR_AGENT_ID: 'agent-id'
};

test('parses application configuration lazily and reuses the same value', () => {
	let reads = 0;
	const provider = createServerConfigProvider(() => {
		reads += 1;
		return environment;
	});

	assert.equal(reads, 0);
	assert.equal(provider().anthropic.apiKey, 'anthropic-key');
	assert.equal(provider().prefactor.agentId, 'agent-id');
	assert.equal(reads, 1);
});
