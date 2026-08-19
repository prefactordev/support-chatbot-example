import { createFeedbackHandler } from '$lib/server/feedback-handler';
import { prefactorSessions, sensitive } from '$lib/server/prefactor';

const FEEDBACK_SENSITIVE_LABELS = [
	'personal_identifiers',
	'behavioural_and_inferred',
	'contact_information',
	'financial_information'
] as const;

const handleFeedback = createFeedbackHandler(async (payload) => {
	await prefactorSessions.traceSensitive(
		payload.sessionId,
		{
			name: 'chatbot:message-feedback',
			spanType: 'chatbot:quality',
			inputs: {
				feedback: {
					scope: 'assistant_message',
					session_id: payload.sessionId,
					message_id: payload.messageId,
					message_content: payload.messageContent
						? sensitive(payload.messageContent, [...FEEDBACK_SENSITIVE_LABELS])
						: null,
					rating: payload.feedback,
					session_name: payload.sessionName ?? null,
					message_count: payload.messageCount ?? null,
					reasons: payload.reasons.length ? payload.reasons : null,
					comment: payload.comment
						? sensitive(payload.comment, [...FEEDBACK_SENSITIVE_LABELS])
						: null
				}
			},
			encodeResult: (value) => {
				const output = value as {
					feedback: {
						recorded: boolean;
						scope: string;
						session_id: string;
						message_id: string;
						rating: string;
						reasons: string[];
						comment: string | null;
					};
				};

				return {
					feedback: {
						...output.feedback,
						comment: output.feedback.comment
							? sensitive(output.feedback.comment, [...FEEDBACK_SENSITIVE_LABELS])
							: null
					}
				};
			}
		},
		() => ({
			feedback: {
				recorded: true,
				scope: 'assistant_message',
				session_id: payload.sessionId,
				message_id: payload.messageId,
				rating: payload.feedback,
				reasons: payload.reasons,
				comment: payload.comment ?? null
			}
		})
	);
});

export function POST({ request }: { request: Request }) {
	return handleFeedback(request);
}
