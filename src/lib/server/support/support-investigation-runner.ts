import type { SensitiveTraceSpan } from '../prefactor-contracts.ts';
import { sensitive, type SensitiveSpanOptions } from '../prefactor-sensitive-span.ts';
import type { SupportIssueType } from './support-tools.ts';

const ACCOUNT_DATA_LABELS = [
	'personal_identifiers',
	'contact_information',
	'financial_information',
	'behavioural_and_inferred'
] as const;

export type SupportInvestigationRequest = {
	sessionId: string;
	issueType: SupportIssueType;
	userRequest: string;
	abortSignal?: AbortSignal;
};

export type SupportInvestigationRuntime<TMiddleware = unknown> = {
	middleware: TMiddleware;
	traceSensitive: SensitiveTraceSpan;
	getAgentInstanceId: () => string | null;
};

export function createSupportInvestigationTraceOptions(
	params: Pick<SupportInvestigationRequest, 'sessionId' | 'issueType' | 'userRequest'>
): SensitiveSpanOptions<string> {
	return {
		name: `chatbot:support-subagent:${params.issueType}`,
		spanType: 'chatbot:support-subagent',
		inputs: {
			support: {
				session_id: params.sessionId,
				issue_type: params.issueType,
				user_request: sensitive(params.userRequest, [
					'personal_identifiers',
					'behavioural_and_inferred'
				])
			}
		},
		encodeResult: (value) => ({
			result: sensitive(String(value), [...ACCOUNT_DATA_LABELS])
		})
	};
}

export function createSupportInvestigationLinkTraceOptions(params: {
	sessionId: string;
	issueType: SupportIssueType;
	subagentAgentInstanceId: string;
	resultPreview: string;
}): SensitiveSpanOptions<{
	subagent_agent_instance_id: string;
	result_preview: string;
}> {
	return {
		name: `chatbot:support-subagent-link:${params.issueType}`,
		spanType: 'chatbot:support-investigation',
		inputs: {
			support: {
				session_id: params.sessionId,
				subagent_agent_instance_id: params.subagentAgentInstanceId,
				issue_type: params.issueType
			}
		},
		encodeResult: (output) => ({
			subagent_agent_instance_id: output.subagent_agent_instance_id,
			result_preview: sensitive(output.result_preview, [...ACCOUNT_DATA_LABELS])
		})
	};
}

type SupportInvestigationDependencies<TMiddleware> = {
	delay: (milliseconds: number) => Promise<void>;
	investigationDelay: (issueType: SupportIssueType) => number;
	generate: (
		request: SupportInvestigationRequest,
		runtime: SupportInvestigationRuntime<TMiddleware>
	) => Promise<string>;
	waitForAgentInstanceId: (getAgentInstanceId: () => string | null) => Promise<string | null>;
	linkSubagentInstance: (
		request: SupportInvestigationRequest & {
			subagentAgentInstanceId: string | null;
			resultPreview: string;
		}
	) => Promise<void>;
	withRuntime: <T>(
		sessionId: string,
		callback: (runtime: SupportInvestigationRuntime<TMiddleware>) => Promise<T>
	) => Promise<T>;
};

export function createSupportInvestigationRunner<TMiddleware = unknown>(
	deps: SupportInvestigationDependencies<TMiddleware>
) {
	return async function runSupportInvestigation(
		request: SupportInvestigationRequest
	): Promise<string> {
		return deps.withRuntime(request.sessionId, async (runtime) => {
			await deps.delay(deps.investigationDelay(request.issueType));

			const text = await deps.generate(request, runtime);

			const subagentAgentInstanceId = await deps.waitForAgentInstanceId(runtime.getAgentInstanceId);
			await deps.linkSubagentInstance({
				...request,
				subagentAgentInstanceId,
				resultPreview: text
			});

			return text;
		});
	};
}
