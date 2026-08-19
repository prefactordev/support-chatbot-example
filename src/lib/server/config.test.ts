import assert from 'node:assert/strict';
import test from 'node:test';
import { parseServerConfig } from './config.ts';

const requiredEnv = {
	ANTHROPIC_API_KEY: 'anthropic-key',
	PREFACTOR_API_URL: 'https://api.prefactor.ai',
	PREFACTOR_API_TOKEN: 'prefactor-token',
	PREFACTOR_AGENT_ID: 'agent-id'
};

test('parses required configuration with documented defaults', () => {
	const config = parseServerConfig(requiredEnv);

	assert.equal(config.anthropic.apiKey, 'anthropic-key');
	assert.equal(config.anthropic.model, 'claude-haiku-4-5');
	assert.equal(config.prefactor.agentIdentifier, '1.0.0');
	assert.equal(config.supportAgent, undefined);
});

test('reports all missing required configuration keys', () => {
	assert.throws(
		() => parseServerConfig({}),
		/ANTHROPIC_API_KEY, PREFACTOR_API_URL, PREFACTOR_API_TOKEN, PREFACTOR_AGENT_ID/
	);
});

test('enables the support Prefactor agent when id and token are present', () => {
	const config = parseServerConfig({
		...requiredEnv,
		PREFACTOR_AGENT_ID_SUPPORT: 'support-agent',
		PREFACTOR_API_TOKEN_SUPPORT: 'support-token'
	});

	assert.deepEqual(config.supportAgent, {
		agentId: 'support-agent',
		apiToken: 'support-token',
		agentIdentifier: '1.0.0'
	});
});

test('does not enable an incompletely configured support Prefactor agent', () => {
	assert.equal(
		parseServerConfig({ ...requiredEnv, PREFACTOR_AGENT_ID_SUPPORT: 'support-agent' }).supportAgent,
		undefined
	);
	assert.equal(
		parseServerConfig({ ...requiredEnv, PREFACTOR_API_TOKEN_SUPPORT: 'support-token' })
			.supportAgent,
		undefined
	);
});

test('uses the configured support Prefactor agent identifier', () => {
	const config = parseServerConfig({
		...requiredEnv,
		PREFACTOR_AGENT_ID_SUPPORT: 'support-agent',
		PREFACTOR_API_TOKEN_SUPPORT: 'support-token',
		PREFACTOR_AGENT_IDENTIFIER_SUPPORT: '2.0.0'
	});

	assert.equal(config.supportAgent?.agentIdentifier, '2.0.0');
});

test('enables LLM evaluation by default and honors EVAL_ENABLED', () => {
	assert.equal(parseServerConfig(requiredEnv).evalEnabled, true);
	assert.equal(parseServerConfig({ ...requiredEnv, EVAL_ENABLED: 'false' }).evalEnabled, false);
	assert.equal(parseServerConfig({ ...requiredEnv, EVAL_ENABLED: '0' }).evalEnabled, false);
	assert.equal(parseServerConfig({ ...requiredEnv, EVAL_ENABLED: 'true' }).evalEnabled, true);
	assert.equal(parseServerConfig({ ...requiredEnv, EVAL_ENABLED: '1' }).evalEnabled, true);
});

test('rejects an unrecognized EVAL_ENABLED value', () => {
	assert.throws(
		() => parseServerConfig({ ...requiredEnv, EVAL_ENABLED: 'fales' }),
		/Invalid boolean value/
	);
});
