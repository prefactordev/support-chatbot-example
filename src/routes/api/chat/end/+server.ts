import { convertToModelMessages, streamText, wrapLanguageModel, type UIMessage } from 'ai';
import { createEndChatHandler } from '$lib/server/end-chat';
import { createChatModel } from '$lib/server/model';
import { prefactorSessions } from '$lib/server/prefactor';
import { getServerConfig } from '$lib/server/application-config';
import {
	createConversationEvaluator,
	createPhoenixJudges
} from '$lib/server/evaluation/conversation-evaluator';
import { createEvaluationRecorder } from '$lib/server/evaluation/record-evaluation';
import { cleanupSupportSession } from '$lib/server/support/support-session-cleanup';

const FAREWELL_INSTRUCTIONS = `You are closing a Northstar Cloud support conversation.
Write one brief, warm thank-you that acknowledges the conversation context.
Do not provide new troubleshooting, ask a question, mention internal systems, or invite another reply.`;

const handleEndChat = createEndChatHandler({
	async *generateFarewell(sessionId, messages) {
		const prefactor = prefactorSessions.acquire(sessionId);
		const model = wrapLanguageModel({
			model: createChatModel(),
			middleware: prefactor.middleware
		});
		const modelMessages = await convertToModelMessages(messages as UIMessage[]);
		const result = streamText({
			model,
			system: FAREWELL_INSTRUCTIONS,
			messages: [...modelMessages, { role: 'user', content: 'End this support conversation now.' }]
		});

		for await (const chunk of result.textStream) yield chunk;
	},
	async finishSession(sessionId) {
		await cleanupSupportSession(sessionId);
		await prefactorSessions.finish(sessionId);
	},
	async evaluateSession(sessionId, messages) {
		if (!getServerConfig().evalEnabled) return;
		const evaluate = createConversationEvaluator(createPhoenixJudges(createChatModel()));
		const record = createEvaluationRecorder({
			evaluate,
			submitQuality: (sessionId, name, qualityPayload) =>
				prefactorSessions.submitQuality(sessionId, name, qualityPayload)
		});
		await record(sessionId, messages);
	}
});

export function POST({ request }: { request: Request }) {
	return handleEndChat(request);
}
