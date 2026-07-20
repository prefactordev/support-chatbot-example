import { generateText, wrapLanguageModel } from 'ai';
import { createChatModel } from '$lib/server/model';
import { prefactorSessions, withSupportSubagentRuntime } from '$lib/server/prefactor';
import { waitForAgentInstanceId } from '$lib/server/prefactor-sensitive-span';
import {
	createSupportInvestigationLinkTraceOptions,
	createSupportInvestigationRunner,
	createSupportInvestigationTraceOptions,
	type SupportInvestigationRequest
} from './support-investigation-runner';
import { stripStandaloneChatOpening } from './support-text';
import { DEMO_ACCOUNT, SUPPORT_RECORDS, type SupportIssueType } from './support-tools';

const INVESTIGATION_SYSTEM = `You are a Northstar Cloud support sub-agent.
Use only the provided demo account and support record facts.
Write one concise assistant update that continues an active chat thread.
Do not greet the user, use their name, sign off, or say "thanks for reaching out".
Start with the outcome of this specific check, such as "For the invoice check..." or "For analytics access...".
Do not repeat questions the foreground assistant already asked; give the result or the next needed verification step.
If the issue requires verification, do not reveal sensitive details; ask for one light confirming detail and say what you can check after that.
For profile changes such as email updates, explain the self-service path; do not ask for the new value or imply you can process the change.
Do not mention internal tools, traces, or that data is hard-coded.`;

type SupportRuntime = Parameters<Parameters<typeof withSupportSubagentRuntime>[1]>[0];
type InvestigationRuntime = Pick<
	SupportRuntime,
	'middleware' | 'traceSensitive' | 'getAgentInstanceId'
>;

async function generateInvestigationText(
	params: SupportInvestigationRequest,
	runtime: InvestigationRuntime
): Promise<string> {
	const record = SUPPORT_RECORDS[params.issueType] ?? SUPPORT_RECORDS.general;
	const model = wrapLanguageModel({ model: createChatModel(), middleware: runtime.middleware });
	const result = await generateText({
		model,
		system: INVESTIGATION_SYSTEM,
		prompt: `User request:
${params.userRequest}

Demo account:
${JSON.stringify(DEMO_ACCOUNT, null, 2)}

Support record:
${JSON.stringify(record, null, 2)}

Verification required: ${record.sensitive ? 'yes' : 'no'}

Write the completed support-check update now.`,
		abortSignal: params.abortSignal
	});
	const text = stripStandaloneChatOpening(result.text.trim());
	await runtime.traceSensitive(createSupportInvestigationTraceOptions(params), () => text);
	return text;
}

async function linkSubagentInstanceOnMainAgent(params: {
	sessionId: string;
	issueType: SupportIssueType;
	subagentAgentInstanceId: string | null;
	resultPreview: string;
}) {
	const subagentAgentInstanceId = params.subagentAgentInstanceId;
	if (!subagentAgentInstanceId) return;
	await prefactorSessions.traceSensitive(
		params.sessionId,
		createSupportInvestigationLinkTraceOptions({
			...params,
			subagentAgentInstanceId
		}),
		() => ({
			subagent_agent_instance_id: subagentAgentInstanceId,
			result_preview: params.resultPreview.slice(0, 240)
		})
	);
}

function investigationDelay(issueType: SupportIssueType): number {
	switch (issueType) {
		case 'billing':
			return 1800;
		case 'permissions':
		case 'security':
			return 1500;
		default:
			return 1200;
	}
}

export const runSupportInvestigation = createSupportInvestigationRunner({
	delay: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
	investigationDelay,
	generate: generateInvestigationText,
	waitForAgentInstanceId,
	linkSubagentInstance: linkSubagentInstanceOnMainAgent,
	withRuntime: withSupportSubagentRuntime
});
