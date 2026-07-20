import { supportJobRegistry } from '$lib/server/support/support-jobs';
import { jsonError } from '$lib/server/http';

export function GET({ request, url }: { request: Request; url: URL }) {
	const sessionId = url.searchParams.get('sessionId');
	if (!sessionId) return jsonError('sessionId is required');

	const encoder = new TextEncoder();
	let unsubscribe: (() => void) | undefined;
	let closed = false;
	const stream = new ReadableStream({
		start(controller) {
			function write(event: unknown, eventId?: string) {
				if (closed) return;
				const idLine = eventId ? `id: ${eventId}\n` : '';
				controller.enqueue(encoder.encode(`${idLine}data: ${JSON.stringify(event)}\n\n`));
			}

			function close() {
				if (closed) return;
				closed = true;
				unsubscribe?.();
				controller.close();
			}

			write({ type: 'connected' });
			const afterEventId =
				request.headers.get('last-event-id') ?? url.searchParams.get('afterEventId') ?? undefined;
			unsubscribe = supportJobRegistry.subscribe(
				sessionId,
				(event) => {
					write({ type: 'support-activity', event }, event.id);
				},
				{ afterEventId }
			);

			request.signal.addEventListener('abort', close);
		},
		cancel() {
			closed = true;
			unsubscribe?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
}
