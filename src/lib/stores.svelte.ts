import { uniqueById } from './messages';
import type { Message, MessageFeedback, Session } from './types';
import { SessionPersistence } from './client/session-persistence';
import {
	assertSessionLimit,
	deleteSession as deleteSessionFromDb,
	loadSessions,
	loadSettings,
	saveSession,
	saveSettings
} from '$lib/db';

const isBrowser = typeof window !== 'undefined';
const MAX_MESSAGES_PER_SESSION = 80;

function createEmptySession(name = 'Chat 1'): Session {
	return {
		id: crypto.randomUUID(),
		name,
		messages: [],
		createdAt: Date.now()
	};
}

class ChatStore {
	sessions = $state<Session[]>([]);
	activeSessionId = $state<string | null>(null);
	darkMode = $state(false);
	dbReady = $state(false);
	persistenceError = $state<string | null>(null);

	private readonly persistence = new SessionPersistence({
		save: saveSession,
		onError: (error) => {
			this.persistenceError =
				error instanceof Error ? error.message : 'Unable to save chat history';
		}
	});

	async init(): Promise<void> {
		if (!isBrowser) return;

		const [sessions, settings] = await Promise.all([loadSessions(), loadSettings()]);

		this.sessions = sessions.length > 0 ? sessions : [createEmptySession()];
		if (sessions.length === 0) await saveSession(this.sessions[0]);

		this.activeSessionId = this.sessions[0]?.id ?? null;
		this.darkMode = settings.darkMode;
		this.dbReady = true;
		document.documentElement.classList.toggle('dark', this.darkMode);
	}

	async toggleDarkMode() {
		this.darkMode = !this.darkMode;
		await saveSettings({
			darkMode: this.darkMode,
			schemaVersion: 1
		});
		if (isBrowser) document.documentElement.classList.toggle('dark', this.darkMode);
	}

	async newSession(): Promise<Session> {
		assertSessionLimit(this.sessions.length);
		const session = createEmptySession(`Chat ${this.sessions.length + 1}`);
		this.sessions = [...this.sessions, session];
		this.activeSessionId = session.id;
		await saveSession(session);
		return session;
	}

	async deleteSession(id: string) {
		this.persistence.cancel(id);
		this.sessions = this.sessions.filter((s) => s.id !== id);
		if (this.activeSessionId === id) {
			this.activeSessionId = this.sessions[0]?.id ?? null;
		}
		await deleteSessionFromDb(id);
	}

	setActiveSession(id: string) {
		this.activeSessionId = id;
	}

	getActiveSession(): Session | undefined {
		return this.sessions.find((s) => s.id === this.activeSessionId);
	}

	syncMessages(id: string, messages: Message[]) {
		const session = this.sessions.find((s) => s.id === id);
		if (!session) return;

		messages = uniqueById(messages);

		const feedbackByMessageId = new Map(
			session.messages
				.filter((message) => message.feedback)
				.map((message) => [message.id, message.feedback])
		);
		messages = messages.map((message) => ({
			...message,
			feedback: message.feedback ?? feedbackByMessageId.get(message.id)
		}));

		if (messages.length > MAX_MESSAGES_PER_SESSION) {
			messages = messages.slice(-MAX_MESSAGES_PER_SESSION);
		}
		session.messages = messages;

		if (messages.length > 0 && messages.length <= 3) {
			const first = messages.find((m) => m.role === 'user')?.content ?? '';
			if (first) session.name = first.length > 40 ? first.slice(0, 40) + '...' : first;
		}

		this.scheduleSave(session);
	}

	appendMessage(id: string, message: Message) {
		const session = this.sessions.find((s) => s.id === id);
		if (!session) return;
		if (session.messages.some((existing) => existing.id === message.id)) return;

		session.messages = [...session.messages, message];
		if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
			session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
		}
		this.scheduleSave(session);
	}

	setMessageFeedback(id: string, messageId: string, feedback: MessageFeedback) {
		const session = this.sessions.find((s) => s.id === id);
		if (!session) return;
		session.messages = session.messages.map((message) =>
			message.id === messageId ? { ...message, feedback } : message
		);
		this.persistence.cancel(id);
		void this.saveNow(session);
	}

	async completeSession(id: string, completedAt = Date.now()) {
		const session = this.sessions.find((s) => s.id === id);
		if (!session || session.completedAt) return;
		session.completedAt = completedAt;
		this.persistence.cancel(id);
		await this.saveNow(session);
	}

	private scheduleSave(session: Session) {
		if (!isBrowser) return;
		this.persistenceError = null;
		this.persistence.schedule(session);
	}

	private async saveNow(session: Session): Promise<void> {
		this.persistenceError = null;
		await this.persistence.saveNow(session);
	}
}

export const store = new ChatStore();
