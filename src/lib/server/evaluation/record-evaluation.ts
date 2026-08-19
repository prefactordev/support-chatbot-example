import type { ConversationEvaluation } from './conversation-evaluator';
import type { EndChatMessage } from '../end-chat';

type SubmitQuality = (
	sessionId: string,
	name: string,
	qualityPayload: Record<string, unknown>
) => void;

export function createEvaluationRecorder(deps: {
	evaluate: (messages: EndChatMessage[]) => Promise<ConversationEvaluation[]>;
	submitQuality: SubmitQuality;
}) {
	return async (sessionId: string, messages: EndChatMessage[]): Promise<void> => {
		const results = await deps.evaluate(messages);
		for (const result of results) {
			deps.submitQuality(sessionId, result.name, {
				score: result.score,
				verdict: result.verdict,
				explanation: result.explanation
			});
		}
	};
}
