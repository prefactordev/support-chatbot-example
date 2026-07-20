export interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	createdAt: number;
	feedback?: MessageFeedback;
}

export interface MessageFeedback {
	rating: 'up' | 'down';
	reasons: string[];
	comment?: string;
	createdAt: number;
}

export interface Session {
	id: string;
	name: string;
	messages: Message[];
	createdAt: number;
	completedAt?: number;
}

export type SupportActivityEvent = {
	id: string;
	jobId: string;
	status: 'started' | 'completed' | 'failed';
	label: string;
	createdAt: number;
	excerpt?: string;
};
