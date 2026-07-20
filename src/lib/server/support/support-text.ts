export function stripStandaloneChatOpening(text: string): string {
	return text
		.replace(/^(hi|hello|hey)\s+maya,?\s*/i, '')
		.replace(/^thanks for reaching out[.!]?\s*/i, '')
		.trim();
}
