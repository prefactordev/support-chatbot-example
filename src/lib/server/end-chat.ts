import { parseJsonRequest } from './http.ts';
import { parseEndChatRequest, validationMessage, type EndChatRequest } from './request-schemas.ts';

export type EndChatMessage = {
	id: string;
	role: string;
	parts: Array<{ type: string; text?: string }>;
};

export type EndChatDependencies = {
	generateFarewell: (sessionId: string, messages: EndChatMessage[]) => AsyncIterable<string>;
	finishSession: (sessionId: string) => Promise<void>;
	evaluateSession?: (sessionId: string, messages: EndChatMessage[]) => Promise<void>;
};

export function createEndChatHandler(deps: EndChatDependencies) {
	return async (request: Request): Promise<Response> => {
		const parsed = await parseJsonRequest(request, parseEndChatRequest, validationMessage);
		if (parsed instanceof Response) return parsed;
		return createEndChatResponse(parsed, deps);
	};
}

export function createEndChatResponse(
	request: EndChatRequest,
	deps: EndChatDependencies
): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const chunk of deps.generateFarewell(request.sessionId, request.messages)) {
					controller.enqueue(encoder.encode(chunk));
				}
			} catch {
				// Completing the chat is authoritative even when the optional farewell fails.
			} finally {
				const evaluateSession = deps.evaluateSession;
				if (evaluateSession) {
					void (async () => {
						try {
							await evaluateSession(request.sessionId, request.messages);
						} finally {
							await deps.finishSession(request.sessionId);
						}
					})().catch(() => undefined);
				} else {
					await deps.finishSession(request.sessionId);
				}
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
}
