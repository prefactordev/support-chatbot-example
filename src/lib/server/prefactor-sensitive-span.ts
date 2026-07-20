import { SpanContext, type Tracer } from '@prefactor/core';

export type SensitiveLabel =
	| 'personal_identifiers'
	| 'contact_information'
	| 'financial_information'
	| 'authentication_and_secrets'
	| 'organisational_confidential'
	| 'behavioural_and_inferred';

type SensitivePrimitiveType = 'string' | 'number' | 'boolean';

export type SensitiveMarker = {
	$sensitive: SensitivePrimitiveType;
	labels: SensitiveLabel[];
	value: string | number | boolean;
};

export type SensitiveSpanOptions<TResult = unknown> = {
	name: string;
	spanType: string;
	inputs: Record<string, unknown>;
	/** Builds sensitive-encoded span outputs while the traced fn returns plaintext. */
	encodeResult?: (result: TResult) => Record<string, unknown>;
};

export function sensitive(
	value: string | number | boolean,
	labels: SensitiveLabel[]
): SensitiveMarker {
	const type: SensitivePrimitiveType =
		typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'boolean';

	return {
		$sensitive: type,
		labels,
		value
	};
}

export function toSpanOutputs(result: unknown): Record<string, unknown> {
	if (isRecord(result)) {
		return result;
	}
	if (result === undefined) {
		return {};
	}
	return { result };
}

export async function waitForAgentInstanceId(
	getAgentInstanceId: () => string | null,
	options: {
		attempts?: number;
		delayMs?: number;
		delay?: (milliseconds: number) => Promise<void>;
	} = {}
): Promise<string | null> {
	const {
		attempts = 12,
		delayMs = 100,
		delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
	} = options;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const instanceId = getAgentInstanceId();
		if (instanceId) return instanceId;
		await delay(delayMs);
	}
	return getAgentInstanceId();
}

export function createSensitiveTracer(deps: { tracer: Tracer; ensureRegistered: () => void }) {
	return async function traceSensitive<T>(
		options: SensitiveSpanOptions<T>,
		fn: () => Promise<T> | T
	): Promise<T> {
		deps.ensureRegistered();

		const span = deps.tracer.startSpan({
			name: options.name,
			spanType: options.spanType,
			inputs: options.inputs,
			sensitiveEncoding: true
		});

		try {
			const result = await SpanContext.runAsync(span, () => Promise.resolve(fn()));
			const outputs = options.encodeResult ? options.encodeResult(result) : toSpanOutputs(result);
			deps.tracer.endSpan(span, { outputs });
			return result;
		} catch (error) {
			deps.tracer.endSpan(span, {
				error: error instanceof Error ? error : new Error(String(error))
			});
			throw error;
		}
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
