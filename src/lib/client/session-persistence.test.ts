import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SessionPersistence } from './session-persistence.ts';
import type { Session } from '../types.ts';

function session(id: string, name = id): Session {
	return { id, name, messages: [], createdAt: 1 };
}

function controlledTimers() {
	let nextId = 0;
	const callbacks = new Map<number, () => void>();
	return {
		setTimer(callback: () => void) {
			const id = ++nextId;
			callbacks.set(id, callback);
			return id;
		},
		clearTimer(id: number) {
			callbacks.delete(id);
		},
		runAll() {
			const pending = [...callbacks.values()];
			callbacks.clear();
			for (const callback of pending) callback();
		}
	};
}

describe('SessionPersistence', () => {
	it('debounces each session independently', async () => {
		const timers = controlledTimers();
		const saved: string[] = [];
		const persistence = new SessionPersistence({
			save: async (value) => void saved.push(value.id),
			setTimer: timers.setTimer,
			clearTimer: timers.clearTimer
		});

		persistence.schedule(session('one'));
		persistence.schedule(session('two'));
		timers.runAll();
		await persistence.flushAll();

		assert.deepEqual(saved.sort(), ['one', 'two']);
	});

	it('replaces only the pending write for the same session', async () => {
		const timers = controlledTimers();
		const saved: string[] = [];
		const persistence = new SessionPersistence({
			save: async (value) => void saved.push(value.name),
			setTimer: timers.setTimer,
			clearTimer: timers.clearTimer
		});

		persistence.schedule(session('one', 'old'));
		persistence.schedule(session('one', 'new'));
		timers.runAll();
		await persistence.flushAll();

		assert.deepEqual(saved, ['new']);
	});

	it('reports failed background writes with their session id', async () => {
		const timers = controlledTimers();
		const failures: Array<{ sessionId: string; error: unknown }> = [];
		const expected = new Error('storage unavailable');
		const persistence = new SessionPersistence({
			save: async () => {
				throw expected;
			},
			setTimer: timers.setTimer,
			clearTimer: timers.clearTimer,
			onError: (error, sessionId) => failures.push({ error, sessionId })
		});

		persistence.schedule(session('one'));
		timers.runAll();
		await persistence.flushAll();

		assert.deepEqual(failures, [{ error: expected, sessionId: 'one' }]);
	});

	it('flushes the latest pending value without waiting for its timer', async () => {
		const timers = controlledTimers();
		const saved: string[] = [];
		const persistence = new SessionPersistence({
			save: async (value) => void saved.push(value.name),
			setTimer: timers.setTimer,
			clearTimer: timers.clearTimer
		});

		persistence.schedule(session('one', 'latest'));
		await persistence.flush('one');
		timers.runAll();

		assert.deepEqual(saved, ['latest']);
	});

	it('cancels a pending write when its session is deleted', async () => {
		const timers = controlledTimers();
		const saved: string[] = [];
		const persistence = new SessionPersistence({
			save: async (value) => void saved.push(value.id),
			setTimer: timers.setTimer,
			clearTimer: timers.clearTimer
		});

		persistence.schedule(session('deleted'));
		persistence.cancel('deleted');
		timers.runAll();
		await persistence.flushAll();

		assert.deepEqual(saved, []);
	});

	it('writes newer immediate state after an in-flight debounced write', async () => {
		const timers = controlledTimers();
		const saved: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const firstWrite = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		let writes = 0;
		const persistence = new SessionPersistence({
			save: async (value) => {
				writes += 1;
				if (writes === 1) await firstWrite;
				saved.push(value.name);
			},
			setTimer: timers.setTimer,
			clearTimer: timers.clearTimer
		});

		persistence.schedule(session('one', 'streaming'));
		timers.runAll();
		const immediateWrite = persistence.saveNow(session('one', 'completed'));
		assert.equal(writes, 1);
		releaseFirst?.();
		await immediateWrite;

		assert.deepEqual(saved, ['streaming', 'completed']);
	});
});
