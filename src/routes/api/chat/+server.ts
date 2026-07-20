import { createAgentUIStreamResponse } from 'ai';
import { wrapLanguageModel } from 'ai';
import { createMainAgent } from '$lib/server/agents/main-agent';
import { parseJsonRequest } from '$lib/server/http';
import { createChatModel } from '$lib/server/model';
import { prefactorSessions } from '$lib/server/prefactor';
import { parseChatRequest, validationMessage } from '$lib/server/request-schemas';

export async function POST({ request }: { request: Request }) {
	const body = await parseJsonRequest(request, parseChatRequest, validationMessage);
	if (body instanceof Response) return body;

	const { sessionId, messages: uiMessages } = body;

	const prefactor = prefactorSessions.acquire(sessionId);
	const model = wrapLanguageModel({
		model: createChatModel(),
		middleware: prefactor.middleware
	});
	const agent = createMainAgent({
		model,
		sessionId,
		trace: prefactor.trace,
		traceSensitive: prefactor.traceSensitive
	});

	return prefactorSessions.stream(
		sessionId,
		{
			chat: {
				session_id: sessionId,
				message_count: uiMessages.length,
				scenario: 'northstar-cloud-support'
			}
		},
		(end) =>
			createAgentUIStreamResponse({
				agent,
				uiMessages,
				abortSignal: request.signal,
				onFinish: ({ isAborted }) => end(isAborted ? 'aborted' : 'completed')
			})
	);
}
