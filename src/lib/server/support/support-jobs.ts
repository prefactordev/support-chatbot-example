import type { Message, SupportActivityEvent } from '$lib/types';
import type { SupportIssueType } from './support-tools';

type SupportJobStatus = 'running' | 'completed' | 'failed';

type SupportJob = {
	id: string;
	sessionId: string;
	issueType: SupportIssueType;
	userRequest: string;
	label: string;
	status: SupportJobStatus;
	createdAt: number;
	completedAt?: number;
	result?: string;
};

export type SupportJobStartResult = Readonly<{
	id: string;
	label: string;
	reused: boolean;
}>;

export type SupportJobEvent =
	| (SupportActivityEvent & { status: 'started' })
	| (SupportActivityEvent & { status: 'completed'; message: Message })
	| (SupportActivityEvent & { status: 'failed'; message: Message });

type Subscriber = (event: SupportJobEvent) => void;
type ErrorReporter = (
	error: unknown,
	context: { jobId: string; sessionId: string; issueType: SupportIssueType }
) => void;

type RegistryOptions = {
	now?: () => number;
	createId?: () => string;
	dedupeTtlMs?: number;
	retentionTtlMs?: number;
	maxEventsPerSession?: number;
	reportError?: ErrorReporter;
};

const DEFAULT_DEDUPE_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_EVENTS = 100;

export class SupportJobRegistry {
	#jobs = new Map<string, SupportJob>();
	#events = new Map<string, SupportJobEvent[]>();
	#running = new Map<string, Set<Promise<void>>>();
	#subscribers = new Map<string, Set<Subscriber>>();
	#now: () => number;
	#createId: () => string;
	#dedupeTtlMs: number;
	#maxEventsPerSession: number;
	#retentionTtlMs: number;
	#reportError: ErrorReporter;

	constructor(options: RegistryOptions = {}) {
		this.#now = options.now ?? Date.now;
		this.#createId = options.createId ?? (() => crypto.randomUUID());
		this.#dedupeTtlMs = options.dedupeTtlMs ?? DEFAULT_DEDUPE_TTL_MS;
		this.#maxEventsPerSession = options.maxEventsPerSession ?? DEFAULT_MAX_EVENTS;
		this.#retentionTtlMs = options.retentionTtlMs ?? 10 * 60_000;
		this.#reportError =
			options.reportError ??
			((error, context) => console.error('Support investigation failed', context, error));
	}

	#publish(sessionId: string, event: SupportJobEvent) {
		const events = this.#events.get(sessionId) ?? [];
		events.push(event);
		if (events.length > this.#maxEventsPerSession)
			events.splice(0, events.length - this.#maxEventsPerSession);
		this.#events.set(sessionId, events);
		for (const subscriber of this.#subscribers.get(sessionId) ?? []) subscriber(event);
	}

	subscribe(
		sessionId: string,
		subscriber: Subscriber,
		options: { afterEventId?: string } = {}
	): () => void {
		this.#pruneTerminalSession(sessionId);
		const retained = this.#events.get(sessionId) ?? [];
		const cursorIndex = options.afterEventId
			? retained.findIndex((event) => event.id === options.afterEventId)
			: -1;
		for (const event of retained.slice(cursorIndex + 1)) subscriber(event);

		let set = this.#subscribers.get(sessionId);
		if (!set) this.#subscribers.set(sessionId, (set = new Set()));
		set.add(subscriber);
		return () => {
			set?.delete(subscriber);
			if (set?.size === 0) this.#subscribers.delete(sessionId);
		};
	}

	start(params: {
		sessionId: string;
		issueType: SupportIssueType;
		userRequest: string;
		run: () => Promise<string>;
	}): SupportJobStartResult {
		this.#pruneTerminalSession(params.sessionId);
		const existing = this.#findExisting(params.sessionId, params.issueType, params.userRequest);
		if (existing) return Object.freeze({ id: existing.id, label: existing.label, reused: true });

		const id = this.#createId();
		const job: SupportJob = {
			id,
			sessionId: params.sessionId,
			issueType: params.issueType,
			userRequest: params.userRequest,
			label: labelForIssue(params.issueType),
			status: 'running',
			createdAt: this.#now()
		};
		this.#jobs.set(id, job);
		this.#publish(params.sessionId, {
			id: `${id}:started`,
			jobId: id,
			status: 'started',
			label: job.label,
			createdAt: job.createdAt
		});

		const running = this.#run(job, params);
		let sessionRuns = this.#running.get(params.sessionId);
		if (!sessionRuns) this.#running.set(params.sessionId, (sessionRuns = new Set()));
		sessionRuns.add(running);
		void running.finally(() => {
			sessionRuns?.delete(running);
			if (sessionRuns?.size === 0) this.#running.delete(params.sessionId);
		});
		return Object.freeze({ id, label: job.label, reused: false });
	}

	#findExisting(sessionId: string, issueType: SupportIssueType, userRequest: string) {
		const normalizedRequest = normalizeRequest(userRequest);
		const now = this.#now();
		for (const job of this.#jobs.values()) {
			if (job.sessionId !== sessionId || job.issueType !== issueType || job.status === 'failed')
				continue;
			if (job.status === 'completed') {
				if (now - (job.completedAt ?? 0) > this.#dedupeTtlMs) continue;
				const resultIsReplayable = this.#events
					.get(sessionId)
					?.some((event) => event.jobId === job.id && event.status === 'completed');
				if (!resultIsReplayable) continue;
			}
			if (normalizeRequest(job.userRequest) === normalizedRequest) return job;
		}
	}

	async #run(job: SupportJob, params: { sessionId: string; run: () => Promise<string> }) {
		try {
			const result = await params.run();
			const completedAt = this.#now();
			Object.assign(job, { status: 'completed' as const, result, completedAt });
			this.#publish(params.sessionId, {
				id: `${job.id}:completed`,
				jobId: job.id,
				status: 'completed',
				label: job.label,
				createdAt: completedAt,
				message: {
					id: `${job.id}:message`,
					role: 'assistant',
					content: result,
					createdAt: completedAt
				}
			});
		} catch (error: unknown) {
			const completedAt = this.#now();
			Object.assign(job, { status: 'failed' as const, completedAt });
			this.#reportError(error, {
				jobId: job.id,
				sessionId: job.sessionId,
				issueType: job.issueType
			});
			const publicMessage = 'Support investigation failed';
			this.#publish(params.sessionId, {
				id: `${job.id}:failed`,
				jobId: job.id,
				status: 'failed',
				label: job.label,
				createdAt: completedAt,
				excerpt: publicMessage,
				message: {
					id: `${job.id}:message`,
					role: 'assistant',
					content: `I could not finish that support check. Please try again.`,
					createdAt: completedAt
				}
			});
		}
	}

	async cleanupSession(sessionId: string): Promise<void> {
		await Promise.allSettled([...(this.#running.get(sessionId) ?? [])]);
		for (const [id, job] of this.#jobs) if (job.sessionId === sessionId) this.#jobs.delete(id);
		this.#events.delete(sessionId);
		this.#subscribers.delete(sessionId);
	}

	#pruneTerminalSession(sessionId: string): void {
		if (this.#running.has(sessionId)) return;
		const events = this.#events.get(sessionId);
		const latest = events?.at(-1);
		if (!latest || this.#now() - latest.createdAt <= this.#retentionTtlMs) return;
		for (const [id, job] of this.#jobs) if (job.sessionId === sessionId) this.#jobs.delete(id);
		this.#events.delete(sessionId);
	}
}

function normalizeRequest(input: string): string {
	return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function labelForIssue(issueType: SupportIssueType): string {
	switch (issueType) {
		case 'billing':
			return 'checking billing details';
		case 'feature_access':
			return 'checking feature access';
		case 'permissions':
			return 'checking workspace permissions';
		case 'security':
			return 'checking security settings';
		case 'subscription':
			return 'checking subscription status';
		case 'account_access':
			return 'checking account access';
		default:
			return 'checking account details';
	}
}

export const supportJobRegistry = new SupportJobRegistry();
