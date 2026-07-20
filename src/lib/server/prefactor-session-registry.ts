import type { StartSpanOptions } from '@prefactor/core';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ChatStatus, PrefactorRuntime } from './prefactor-contracts';

const emptyAsyncContextSnapshot = AsyncLocalStorage.snapshot();

function runWithoutInheritedAsyncContext<TOutput>(callback: () => TOutput): TOutput {
	return emptyAsyncContextSnapshot(callback);
}

export function createWithSupportSubagentRuntime<
	T extends { finishRun: () => Promise<void> | void }
>(deps: {
	createSupportRuntime: () => T | undefined;
	acquireMainRuntime: (sessionId: string) => T;
	runDetached?: <TOutput>(callback: () => TOutput) => TOutput;
}) {
	const runDetached = deps.runDetached ?? runWithoutInheritedAsyncContext;
	return async function withSupportRuntime<TOutput>(
		sessionId: string,
		callback: (runtime: T) => Promise<TOutput> | TOutput
	): Promise<TOutput> {
		const supportRuntime = deps.createSupportRuntime();
		if (!supportRuntime) {
			return await callback(deps.acquireMainRuntime(sessionId));
		}

		return await runDetached(async () => {
			try {
				return await callback(supportRuntime);
			} finally {
				await supportRuntime.finishRun();
			}
		});
	};
}

export function createPrefactorSessionRegistry<T extends PrefactorRuntime>(
	createRuntime: () => T,
	options: { idleTtlMs?: number; now?: () => number } = {}
) {
	const idleTtlMs = options.idleTtlMs ?? 30 * 60 * 1000;
	const now = options.now ?? Date.now;
	const runtimes = new Map<string, { runtime: T; lastUsedAt: number }>();

	async function prune(at = now()) {
		for (const [sessionId, entry] of runtimes) {
			if (at - entry.lastUsedAt <= idleTtlMs) continue;
			try {
				await entry.runtime.finishRun();
			} finally {
				runtimes.delete(sessionId);
			}
		}
	}

	function acquire(sessionId: string): T {
		const cached = runtimes.get(sessionId);
		if (cached) {
			cached.lastUsedAt = now();
			return cached.runtime;
		}

		const runtime = createRuntime();
		runtimes.set(sessionId, { runtime, lastUsedAt: now() });
		return runtime;
	}

	async function chatStream<TOutput>(
		sessionId: string,
		options: StartSpanOptions,
		run: (end: (status: ChatStatus) => void) => Promise<TOutput>
	) {
		await prune();
		const runtime = acquire(sessionId);
		return runtime.chatStream(options, async (end) =>
			run((status) => {
				const entry = runtimes.get(sessionId);
				if (entry) entry.lastUsedAt = now();
				end(status);
			})
		);
	}

	async function finish(sessionId: string) {
		const entry = runtimes.get(sessionId);
		if (!entry) return;
		try {
			await entry.runtime.finishRun();
		} finally {
			runtimes.delete(sessionId);
		}
	}

	return { acquire, chatStream, finish, prune };
}
