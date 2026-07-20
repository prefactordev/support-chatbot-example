import { z } from 'zod';

const messagePartSchema = z.object({ type: z.string(), text: z.string().optional() }).passthrough();
const messageSchema = z
	.object({
		id: z.string().min(1),
		role: z.string().min(1),
		parts: z.array(messagePartSchema)
	})
	.passthrough();

const chatRequestSchema = z
	.object({
		sessionId: z.string({ error: 'sessionId is required' }).trim().min(1, 'sessionId is required'),
		messages: z.array(messageSchema).min(1, 'messages must not be empty')
	})
	.passthrough();

const endChatRequestSchema = z.object({
	sessionId: z.string({ error: 'sessionId is required' }).trim().min(1, 'sessionId is required'),
	messages: z.array(messageSchema).min(1, 'messages must not be empty')
});

const feedbackRequestSchema = z.object({
	sessionId: z.string({ error: 'sessionId is required' }).trim().min(1, 'sessionId is required'),
	messageId: z.string({ error: 'messageId is required' }).trim().min(1, 'messageId is required'),
	messageContent: z
		.string()
		.trim()
		.default('')
		.transform((value) => value.slice(0, 4000)),
	feedback: z.enum(['up', 'down']),
	reasons: z
		.array(z.unknown())
		.default([])
		.transform((reasons) =>
			reasons.filter((reason): reason is string => typeof reason === 'string')
		),
	comment: z
		.string()
		.trim()
		.optional()
		.transform((value) => value || undefined),
	sessionName: z.string().optional(),
	messageCount: z.number().int().nonnegative().optional()
});

export type EndChatRequest = z.infer<typeof endChatRequestSchema>;
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export function parseChatRequest(body: unknown) {
	return chatRequestSchema.parse(body);
}

export function parseEndChatRequest(body: unknown) {
	return endChatRequestSchema.parse(body);
}

export function parseFeedbackRequest(body: unknown) {
	return feedbackRequestSchema.parse(body);
}

export function validationMessage(error: unknown): string {
	if (!(error instanceof z.ZodError)) return 'Invalid request';
	return error.issues[0]?.message ?? 'Invalid request';
}
