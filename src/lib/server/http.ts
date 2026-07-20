export function jsonError(message: string, status = 400): Response {
	return Response.json({ error: message }, { status });
}

export async function parseJsonRequest<T>(
	request: Request,
	parse: (body: unknown) => T,
	formatError: (error: unknown) => string = () => 'Invalid request'
): Promise<T | Response> {
	try {
		return parse(await request.json());
	} catch (error) {
		return jsonError(formatError(error));
	}
}
