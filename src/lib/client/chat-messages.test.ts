import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UIMessage } from 'ai';
import { buildTimeline, messageText, toStoredMessage, toUIMessage } from './chat-messages.ts';
import type { Message, SupportActivityEvent } from '$lib/types';

describe('chat message adapters', () => {
	it('extracts and joins text parts', () => {
		const message = {
			id: 'm1',
			role: 'assistant',
			parts: [
				{ type: 'text', text: 'Hello' },
				{ type: 'text', text: ' world' }
			]
		} as UIMessage;

		assert.equal(messageText(message), 'Hello world');
	});

	it('converts between stored and UI messages without changing content', () => {
		const stored: Message = {
			id: 'm1',
			role: 'user',
			content: 'Help me',
			createdAt: 42
		};

		const ui = toUIMessage(stored);
		assert.deepEqual(ui, {
			id: 'm1',
			role: 'user',
			parts: [{ type: 'text', text: 'Help me' }]
		});
		assert.deepEqual(toStoredMessage(ui, 42), stored);
	});
});

describe('buildTimeline', () => {
	it('deduplicates stored messages and sorts messages with activity chronologically', () => {
		const ui = toUIMessage({ id: 'live', role: 'assistant', content: 'Live', createdAt: 20 });
		const stored: Message[] = [
			{ id: 'stored', role: 'user', content: 'Stored', createdAt: 10 },
			{ id: 'live', role: 'assistant', content: 'Duplicate', createdAt: 20 }
		];
		const activity = {
			id: 'event',
			createdAt: 15
		} as SupportActivityEvent;

		const timeline = buildTimeline([ui], stored, [activity], () => 20);

		assert.deepEqual(
			timeline.map((item) => item.id),
			['stored-message-stored', 'activity-event', 'message-live']
		);
	});
});
