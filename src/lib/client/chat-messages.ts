import type { UIMessage } from 'ai';
import type { Message, SupportActivityEvent } from '../types.ts';

export type TimelineItem =
	| { id: string; kind: 'message'; message: UIMessage; createdAt: number; order: number }
	| {
			id: string;
			kind: 'activity';
			event: SupportActivityEvent;
			createdAt: number;
			order: number;
	  };

export function messageText(message: UIMessage): string {
	return message.parts
		.filter((part) => part.type === 'text')
		.map((part) => part.text)
		.join('');
}

export function toUIMessage(message: Message): UIMessage {
	return {
		id: message.id,
		role: message.role,
		parts: [{ type: 'text', text: message.content }]
	};
}

export function toStoredMessage(message: UIMessage, createdAt: number): Message {
	return {
		id: message.id,
		role: message.role === 'user' ? 'user' : 'assistant',
		content: messageText(message),
		createdAt
	};
}

export function buildTimeline(
	chatMessages: UIMessage[],
	storedMessages: Message[],
	activity: SupportActivityEvent[],
	createdAtFor: (messageId: string, order: number) => number
): TimelineItem[] {
	const chatMessageIds = new Set(chatMessages.map((message) => message.id));
	return [
		...chatMessages.map((message, order) => ({
			id: `message-${message.id}`,
			kind: 'message' as const,
			message,
			createdAt: createdAtFor(message.id, order),
			order
		})),
		...storedMessages
			.filter((message) => !chatMessageIds.has(message.id))
			.map((message, order) => ({
				id: `stored-message-${message.id}`,
				kind: 'message' as const,
				message: toUIMessage(message),
				createdAt: message.createdAt,
				order: order + 5_000
			})),
		...activity.map((event, order) => ({
			id: `activity-${event.id}`,
			kind: 'activity' as const,
			event,
			createdAt: event.createdAt,
			order: order + 10_000
		}))
	].sort((left, right) => left.createdAt - right.createdAt || left.order - right.order);
}
