import type { Session } from '../types.ts';

export type SessionPersistenceOptions<TimerHandle = ReturnType<typeof setTimeout>> = {
	save: (session: Session) => Promise<void>;
	delayMs?: number;
	setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
	clearTimer?: (handle: TimerHandle) => void;
	onError?: (error: unknown, sessionId: string) => void;
};

type PendingWrite<TimerHandle> = {
	session: Session;
	timer: TimerHandle;
};

function snapshotSession(session: Session): Session {
	return {
		...session,
		messages: session.messages.map((message) => ({
			...message,
			feedback: message.feedback
				? { ...message.feedback, reasons: [...message.feedback.reasons] }
				: undefined
		}))
	};
}

/** Coordinates delayed IndexedDB writes without coupling the chat store to timers. */
export class SessionPersistence<TimerHandle = ReturnType<typeof setTimeout>> {
	private readonly delayMs: number;
	private readonly save: (session: Session) => Promise<void>;
	private readonly setTimer: (callback: () => void, delayMs: number) => TimerHandle;
	private readonly clearTimer: (handle: TimerHandle) => void;
	private readonly onError: (error: unknown, sessionId: string) => void;
	private readonly pending = new Map<string, PendingWrite<TimerHandle>>();
	private readonly inFlight = new Set<Promise<void>>();
	private readonly latestWrite = new Map<string, Promise<void>>();

	constructor(options: SessionPersistenceOptions<TimerHandle>) {
		this.delayMs = options.delayMs ?? 250;
		this.save = options.save;
		this.setTimer =
			options.setTimer ??
			((callback, delayMs) => setTimeout(callback, delayMs) as unknown as TimerHandle);
		this.clearTimer =
			options.clearTimer ??
			((handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>));
		this.onError = options.onError ?? (() => undefined);
	}

	schedule(session: Session): void {
		const existing = this.pending.get(session.id);
		if (existing) this.clearTimer(existing.timer);

		const snapshot = snapshotSession(session);
		const timer = this.setTimer(() => void this.persist(session.id), this.delayMs);
		this.pending.set(session.id, { session: snapshot, timer });
	}

	async flush(sessionId: string): Promise<void> {
		const write = this.pending.get(sessionId);
		if (!write) return;
		this.clearTimer(write.timer);
		await this.persist(sessionId);
	}

	async flushAll(): Promise<void> {
		await Promise.all([...this.pending.keys()].map((sessionId) => this.flush(sessionId)));
		await Promise.all([...this.inFlight]);
	}

	async saveNow(session: Session): Promise<void> {
		this.cancel(session.id);
		await this.enqueue(snapshotSession(session));
	}

	cancel(sessionId: string): void {
		const write = this.pending.get(sessionId);
		if (!write) return;
		this.clearTimer(write.timer);
		this.pending.delete(sessionId);
	}

	private async persist(sessionId: string): Promise<void> {
		const write = this.pending.get(sessionId);
		if (!write) return;
		this.pending.delete(sessionId);

		await this.enqueue(write.session);
	}

	private async enqueue(session: Session): Promise<void> {
		const previous = this.latestWrite.get(session.id);
		const save = () =>
			this.save(session).catch((error: unknown) => {
				this.onError(error, session.id);
			});
		const operation = previous ? previous.then(save) : save();
		this.latestWrite.set(session.id, operation);
		this.inFlight.add(operation);
		try {
			await operation;
		} finally {
			this.inFlight.delete(operation);
			if (this.latestWrite.get(session.id) === operation) this.latestWrite.delete(session.id);
		}
	}
}
