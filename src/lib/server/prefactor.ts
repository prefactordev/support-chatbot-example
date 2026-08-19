import {
	createConfig,
	createCore,
	SpanContext,
	withSpan as coreWithSpan,
	type StartSpanOptions
} from '@prefactor/core';
import { PrefactorAISDK } from '@prefactor/ai';
import spanTypeSchemas from './prefactor-schemas/span-types.json';
import { createSensitiveTracer, type SensitiveSpanOptions } from './prefactor-sensitive-span';
import {
	createPrefactorSessionRegistry,
	createWithSupportSubagentRuntime
} from './prefactor-session-registry';
import type { SensitiveTraceSpan, TraceSpan } from './prefactor-contracts';
import { createRegistrationGuard } from './prefactor-sdk-lifecycle';
import { getServerConfig } from './application-config';
import { QUALITY_SCHEMAS } from './evaluation/quality-schemas';

const AGENT_SCHEMA = {
	external_identifier: 'ai-sdk-schema-v7',
	span_type_schemas: spanTypeSchemas,
	quality_schemas: QUALITY_SCHEMAS
};

function createRuntime(params: {
	apiUrl: string;
	agentId: string;
	apiToken: string;
	agentIdentifier: string;
}) {
	const provider = new PrefactorAISDK({ agentSchema: AGENT_SCHEMA });
	const config = createConfig({
		httpConfig: {
			apiUrl: params.apiUrl,
			apiToken: params.apiToken,
			agentId: params.agentId,
			agentIdentifier: params.agentIdentifier,
			agentSchema: AGENT_SCHEMA
		}
	});
	const core = createCore(config, { sdkHeaderEntry: provider.getSdkHeaderEntry() });
	core.agentManager.registerSchema(AGENT_SCHEMA);
	const middleware = provider.createMiddleware(core.tracer, core.agentManager, config);
	const ensureRegistered = createRegistrationGuard(provider, () =>
		core.agentManager.startInstance()
	);
	const traceSensitive = createSensitiveTracer({
		tracer: core.tracer,
		ensureRegistered
	});

	return {
		middleware,
		trace: ((options, fn) => coreWithSpan(core.tracer, options, fn)) as TraceSpan,
		traceSensitive,
		async chatStream<T>(
			options: StartSpanOptions,
			run: (end: (status: 'completed' | 'aborted') => void) => Promise<T>
		) {
			const span = core.tracer.startSpan(options);
			let ended = false;
			const end = (status: 'completed' | 'aborted') => {
				if (ended) return;
				ended = true;
				core.tracer.endSpan(span, { outputs: { chat: { status } } });
			};

			try {
				return await SpanContext.runAsync(span, () => run(end));
			} catch (error) {
				if (!ended) {
					ended = true;
					core.tracer.endSpan(span, {
						error: error instanceof Error ? error : new Error(String(error))
					});
				}
				throw error;
			}
		},
		getAgentInstanceId: () => core.agentManager.getAgentInstanceId(),
		submitQuality(name: string, qualityPayload: Record<string, unknown>) {
			ensureRegistered();
			core.agentManager.recordQuality({ name, payload: qualityPayload });
		},
		async finishRun() {
			await provider.shutdown();
			core.terminationMonitor.reset();
			await core.shutdown();
		}
	};
}

type SupportSubagentRuntime = ReturnType<typeof createRuntime>;

const mainSessionRuntimes = createPrefactorSessionRegistry(() => createMainRuntime());

function createMainRuntime() {
	const { prefactor } = getServerConfig();
	return createRuntime({
		apiUrl: prefactor.apiUrl,
		agentId: prefactor.agentId,
		apiToken: prefactor.apiToken,
		agentIdentifier: prefactor.agentIdentifier
	});
}

function createSupportSubagentRuntime(): SupportSubagentRuntime | undefined {
	const serverConfig = getServerConfig();
	const supportConfig = serverConfig.supportAgent;
	if (!supportConfig) return undefined;

	return createRuntime({
		apiUrl: serverConfig.prefactor.apiUrl,
		agentId: supportConfig.agentId,
		apiToken: supportConfig.apiToken,
		agentIdentifier: supportConfig.agentIdentifier
	});
}

export const withSupportSubagentRuntime = createWithSupportSubagentRuntime({
	createSupportRuntime: createSupportSubagentRuntime,
	acquireMainRuntime: (sessionId) => mainSessionRuntimes.acquire(sessionId)
});

/** Explicit boundary for every session-scoped Prefactor lifecycle operation. */
export const prefactorSessions = {
	acquire(sessionId: string) {
		return mainSessionRuntimes.acquire(sessionId);
	},
	stream<T>(
		sessionId: string,
		inputs: Record<string, unknown>,
		run: (end: (status: 'completed' | 'aborted') => void) => Promise<T>
	) {
		return mainSessionRuntimes.chatStream(
			sessionId,
			{ name: 'chatbot:chat', spanType: 'chatbot:chat', inputs },
			run
		);
	},
	trace<T>(sessionId: string, options: StartSpanOptions, fn: () => Promise<T> | T) {
		return mainSessionRuntimes.acquire(sessionId).trace(options, fn);
	},
	traceSensitive<T>(sessionId: string, options: SensitiveSpanOptions<T>, fn: () => Promise<T> | T) {
		return mainSessionRuntimes.acquire(sessionId).traceSensitive(options, fn);
	},
	submitQuality(sessionId: string, name: string, qualityPayload: Record<string, unknown>) {
		return mainSessionRuntimes.acquire(sessionId).submitQuality(name, qualityPayload);
	},
	finish(sessionId: string) {
		return mainSessionRuntimes.finish(sessionId);
	},
	prune() {
		return mainSessionRuntimes.prune();
	}
};

export type {
	SensitiveSpanOptions,
	SensitiveLabel,
	SensitiveMarker
} from './prefactor-sensitive-span';
export { sensitive } from './prefactor-sensitive-span';
