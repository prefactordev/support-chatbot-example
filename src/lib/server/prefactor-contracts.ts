import type { StartSpanOptions } from '@prefactor/core';
import type { SensitiveSpanOptions } from './prefactor-sensitive-span';

export type TraceSpan = <T>(options: StartSpanOptions, fn: () => Promise<T> | T) => Promise<T>;

export type SensitiveTraceSpan = <T>(
	options: SensitiveSpanOptions<T>,
	fn: () => Promise<T> | T
) => Promise<T>;

export type ChatStatus = 'completed' | 'aborted';

export type PrefactorRuntime = {
	middleware: unknown;
	trace: TraceSpan;
	traceSensitive: SensitiveTraceSpan;
	chatStream: <T>(
		options: StartSpanOptions,
		run: (end: (status: ChatStatus) => void) => Promise<T>
	) => Promise<T>;
	getAgentInstanceId: () => string | null;
	submitQuality: (name: string, qualityPayload: Record<string, unknown>) => void;
	finishRun: () => Promise<void>;
};
