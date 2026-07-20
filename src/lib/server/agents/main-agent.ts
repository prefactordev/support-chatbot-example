import { ToolLoopAgent, stepCountIs, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { SensitiveTraceSpan, TraceSpan } from '$lib/server/prefactor-contracts';
import { sensitive } from '$lib/server/prefactor';
import { supportJobRegistry } from '$lib/server/support/support-jobs';
import { runSupportInvestigation } from '$lib/server/support/support-investigation';
import { classifySupportIssue } from '$lib/server/support/support-tools';

const SUPPORT_INSTRUCTIONS = `You are the Northstar Cloud support assistant.

Demo setup:
- The user is signed in as Maya Chen.
- Keep the conversation natural, concise, and support-focused.
- Ask what you can help with when the user is just greeting you.
- Use tools for account-specific claims.
- For account-specific access, billing, subscription, permissions, security, or MFA requests, start a background support investigation with startSupportInvestigation.
- If a user asks about multiple account-specific issues in one message, call startSupportInvestigation once for each issue type before giving the foreground acknowledgement.
- When you start background investigations, acknowledge them briefly in one sentence.
- Do not ask clarifying questions about an issue after dispatching a background investigation for that same issue; let the support check return first.
- If the user sends another request while checks are running, treat it as a continuation and dispatch another check when appropriate.
- If billing, security, permissions, or access-changing help is sensitive, ask for one light confirming detail before revealing sensitive details or suggesting a change.
- For profile changes such as email updates, explain where the user can make the change; do not ask for the new value or imply you will process the change.
- Never mention GitHub, repositories, codebases, indexes, or old explorer behavior.
- Never claim you changed account state; this demo can only inspect and guide.`;

export function createMainAgent(params: {
	model: LanguageModel;
	sessionId: string;
	trace: TraceSpan;
	traceSensitive: SensitiveTraceSpan;
}) {
	return new ToolLoopAgent({
		id: 'support-agent',
		model: params.model,
		instructions: SUPPORT_INSTRUCTIONS,
		tools: {
			classifySupportIssue: tool({
				description: 'Classify a user support request into the closest demo support issue type.',
				inputSchema: z.object({
					request: z.string().describe('The user request to classify')
				}),
				execute: async ({ request }) => ({ issueType: classifySupportIssue(request) })
			}),
			startSupportInvestigation: tool({
				description:
					'Start a background support investigation for an account-specific support request. Use this for every access, billing, subscription, permissions, security, or MFA lookup so the user can keep chatting.',
				inputSchema: z.object({
					issueType: z.enum([
						'account_access',
						'billing',
						'feature_access',
						'permissions',
						'security',
						'subscription',
						'general'
					]),
					userRequest: z.string().describe('The current user request that needs investigation')
				}),
				execute: async ({ issueType, userRequest }) => {
					const classifiedIssueType = classifySupportIssue(userRequest);
					const normalizedIssueType =
						classifiedIssueType === 'general' ? issueType : classifiedIssueType;

					return params.traceSensitive(
						{
							name: `chatbot:support-investigation:${normalizedIssueType}`,
							spanType: 'chatbot:support-investigation',
							inputs: {
								support: {
									session_id: params.sessionId,
									issue_type: normalizedIssueType,
									requested_issue_type: issueType,
									user_request: sensitive(userRequest, [
										'personal_identifiers',
										'behavioural_and_inferred'
									])
								}
							}
						},
						async () => {
							const job = supportJobRegistry.start({
								sessionId: params.sessionId,
								issueType: normalizedIssueType,
								userRequest,
								run: () => {
									return runSupportInvestigation({
										sessionId: params.sessionId,
										issueType: normalizedIssueType,
										userRequest
									});
								}
							});
							return { jobId: job.id, label: job.label, reused: job.reused ?? false };
						}
					);
				}
			})
		},
		stopWhen: stepCountIs(10)
	});
}
