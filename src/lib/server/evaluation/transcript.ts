import type { EndChatMessage } from '../end-chat';

/**
 * Collapses a conversation into a single role-tagged transcript for
 * session-level LLM evaluation. Non-text parts are ignored.
 */
export function buildTranscript(messages: EndChatMessage[]): string {
	return messages
		.map((message) => {
			const text = message.parts
				.filter((part) => part.type === 'text')
				.map((part) => part.text ?? '')
				.join('')
				.trim();
			if (!text) return null;
			const role = message.role === 'user' ? 'user' : 'assistant';
			return `${role}: ${text}`;
		})
		.filter((line): line is string => line !== null)
		.join('\n\n');
}
