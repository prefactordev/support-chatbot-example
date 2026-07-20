import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SpanStatus, type Tracer } from '@prefactor/core';
import {
	createSensitiveTracer,
	sensitive,
	toSpanOutputs,
	waitForAgentInstanceId
} from './prefactor-sensitive-span.ts';

test('sensitive builds a typed $sensitive marker', () => {
	assert.deepEqual(sensitive('invoice INV-2047', ['financial_information']), {
		$sensitive: 'string',
		labels: ['financial_information'],
		value: 'invoice INV-2047'
	});
	assert.deepEqual(sensitive(195, ['financial_information']), {
		$sensitive: 'number',
		labels: ['financial_information'],
		value: 195
	});
});

test('toSpanOutputs wraps non-object results', () => {
	assert.deepEqual(toSpanOutputs('done'), { result: 'done' });
	assert.deepEqual(toSpanOutputs({ ok: true }), { ok: true });
});

test('traceSensitive sets sensitiveEncoding on SDK spans', async () => {
	const started: Array<{ sensitiveEncoding?: boolean; inputs: Record<string, unknown> }> = [];
	const ended: Record<string, unknown>[] = [];

	const tracer = {
		startSpan(options: {
			name: string;
			spanType: string;
			inputs: Record<string, unknown>;
			sensitiveEncoding?: boolean;
		}) {
			started.push({
				sensitiveEncoding: options.sensitiveEncoding,
				inputs: options.inputs
			});
			return {
				spanId: 'span-1',
				parentSpanId: null,
				traceId: 'trace-1',
				name: options.name,
				spanType: options.spanType,
				startTime: Date.now(),
				endTime: null,
				status: SpanStatus.RUNNING,
				inputs: options.inputs,
				outputs: null,
				tokenUsage: null,
				error: null,
				metadata: {},
				sensitiveEncoding: options.sensitiveEncoding
			};
		},
		endSpan(_span: unknown, options?: { outputs?: Record<string, unknown> }) {
			ended.push(options?.outputs ?? {});
		}
	} as unknown as Tracer;

	const traceSensitive = createSensitiveTracer({
		tracer,
		ensureRegistered: () => {}
	});

	const result = await traceSensitive(
		{
			name: 'chatbot:support-subagent:billing',
			spanType: 'chatbot:support-subagent',
			inputs: {
				support: {
					user_request: sensitive('check my invoice', ['personal_identifiers'])
				}
			},
			encodeResult: (value) => ({
				result: sensitive(String(value), ['financial_information'])
			})
		},
		() => 'INV-2047'
	);

	assert.equal(result, 'INV-2047');
	assert.equal(started.length, 1);
	assert.equal(started[0]?.sensitiveEncoding, true);
	const userRequest = (started[0]?.inputs.support as { user_request: unknown }).user_request;
	assert.match(JSON.stringify(userRequest), /\$sensitive/);
	assert.match(JSON.stringify(ended[0]?.result), /\$sensitive/);
});

test('waitForAgentInstanceId polls with an injected deterministic delay', async () => {
	let reads = 0;
	const delays: number[] = [];
	const result = await waitForAgentInstanceId(() => (++reads === 3 ? 'agent-3' : null), {
		attempts: 4,
		delayMs: 25,
		delay: async (milliseconds) => {
			delays.push(milliseconds);
		}
	});

	assert.equal(result, 'agent-3');
	assert.equal(reads, 3);
	assert.deepEqual(delays, [25, 25]);
});
