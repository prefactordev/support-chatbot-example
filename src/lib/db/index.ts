import { openDB, type IDBPDatabase } from 'idb';
import type { Session } from '$lib/types';

const DB_NAME = 'northstar-support-chatbot';
const DB_VERSION = 1;

type AppSettings = {
	darkMode: boolean;
	schemaVersion: number;
};

interface AppDB {
	sessions: {
		key: string;
		value: Session;
	};
	settings: {
		key: 'app';
		value: AppSettings;
	};
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

/** Strip Svelte proxies and other non-cloneable values before IDB writes. */
function cloneSession(session: Session): Session {
	return JSON.parse(JSON.stringify(session)) as Session;
}

function getDb(): Promise<IDBPDatabase<AppDB>> {
	if (!dbPromise) {
		dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('sessions')) {
					db.createObjectStore('sessions', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('settings')) {
					db.createObjectStore('settings');
				}
			}
		});
	}
	return dbPromise;
}

export async function loadSessions(): Promise<Session[]> {
	const db = await getDb();
	return db.getAll('sessions');
}

export async function saveSession(session: Session): Promise<void> {
	const db = await getDb();
	await db.put('sessions', cloneSession(session));
}

export async function deleteSession(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('sessions', id);
}

export async function loadSettings(): Promise<AppSettings> {
	const db = await getDb();
	const settings = await db.get('settings', 'app');
	return (
		settings ?? {
			darkMode: false,
			schemaVersion: DB_VERSION
		}
	);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
	const db = await getDb();
	await db.put('settings', settings, 'app');
}

export function assertSessionLimit(count: number): void {
	if (count >= 12) {
		throw new Error('Maximum 12 sessions. Delete an old session first.');
	}
}
