import type { QualitySchema } from '@prefactor/core';

export const QUALITY_SCHEMAS: QualitySchema[] = [
	{
		name: 'resolution',
		title: 'Resolution',
		description: "Whether the support conversation resolved the user's stated issue by the end.",
		schema: {
			type: 'object',
			properties: {
				score: {
					type: 'number',
					enum: [0, 1],
					title: 'Score',
					description: '1 for "resolved", 0 for "not_resolved".'
				},
				verdict: {
					type: 'string',
					enum: ['resolved', 'not_resolved'],
					title: 'Verdict',
					description:
						"The user's issue was addressed with a clear, actionable answer or next step."
				},
				explanation: {
					type: 'string',
					title: 'Explanation',
					description: "The judge's reasoning for the verdict, grounded in the conversation."
				}
			},
			required: ['score', 'verdict', 'explanation'],
			additionalProperties: false
		},
		template:
			'{% if score == 1 %}The issue was resolved{% else %}The issue was not resolved{% endif %}'
	},
	{
		name: 'helpfulness',
		title: 'Helpfulness',
		description: "Whether the assistant's responses were accurate, relevant, and actionable.",
		schema: {
			type: 'object',
			properties: {
				score: {
					type: 'number',
					enum: [0, 1],
					title: 'Score',
					description: '1 for "helpful", 0 for "unhelpful".'
				},
				verdict: {
					type: 'string',
					enum: ['helpful', 'unhelpful'],
					title: 'Verdict',
					description: "The assistant's answers gave the user what they needed to move forward."
				},
				explanation: {
					type: 'string',
					title: 'Explanation',
					description: "The judge's reasoning for the verdict, grounded in the conversation."
				}
			},
			required: ['score', 'verdict', 'explanation'],
			additionalProperties: false
		},
		template:
			'{% if score == 1 %}The response was helpful{% else %}The response was unhelpful{% endif %}'
	},
	{
		name: 'coherence',
		title: 'Coherence',
		description: 'Whether the assistant stayed internally consistent across the conversation.',
		schema: {
			type: 'object',
			properties: {
				score: {
					type: 'number',
					enum: [0, 1],
					title: 'Score',
					description: '1 for "coherent", 0 for "incoherent".'
				},
				verdict: {
					type: 'string',
					enum: ['coherent', 'incoherent'],
					title: 'Verdict',
					description:
						"The assistant never contradicted itself and kept track of the user's question and prior answers."
				},
				explanation: {
					type: 'string',
					title: 'Explanation',
					description: "The judge's reasoning for the verdict, grounded in the conversation."
				}
			},
			required: ['score', 'verdict', 'explanation'],
			additionalProperties: false
		},
		template:
			'{% if score == 1 %}The response was coherent{% else %}The response was incoherent{% endif %}'
	},
	{
		name: 'user_friction',
		title: 'User friction',
		description: 'Whether the user showed signs of frustration during the conversation.',
		schema: {
			type: 'object',
			properties: {
				score: {
					type: 'number',
					enum: [0, 1],
					title: 'Score',
					description: '1 for "not_frustrated", 0 for "frustrated".'
				},
				verdict: {
					type: 'string',
					enum: ['not_frustrated', 'frustrated'],
					title: 'Verdict',
					description:
						'The user stayed engaged and calm, without growing impatience or repeating themselves.'
				},
				explanation: {
					type: 'string',
					title: 'Explanation',
					description: "The judge's reasoning for the verdict, grounded in the conversation."
				}
			},
			required: ['score', 'verdict', 'explanation'],
			additionalProperties: false
		},
		template:
			'{% if score == 1 %}No user friction detected{% else %}User showed frustration{% endif %}'
	}
];
