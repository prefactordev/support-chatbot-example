import { parseJsonRequest } from './http.ts';
import {
	parseFeedbackRequest,
	validationMessage,
	type FeedbackRequest
} from './request-schemas.ts';

type RecordFeedback = (payload: FeedbackRequest) => Promise<void>;

export function createFeedbackHandler(recordFeedback: RecordFeedback) {
	return async (request: Request): Promise<Response> => {
		const payload = await parseJsonRequest(request, parseFeedbackRequest, validationMessage);
		if (payload instanceof Response) return payload;

		await recordFeedback(payload);
		return Response.json({ ok: true });
	};
}
