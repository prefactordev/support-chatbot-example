export type SupportIssueType =
	| 'account_access'
	| 'billing'
	| 'feature_access'
	| 'permissions'
	| 'security'
	| 'subscription'
	| 'general';

type DemoAccountContext = {
	productName: string;
	customerName: string;
	email: string;
	signedIn: boolean;
	plan: string;
	renewalDate: string;
	lastInvoice: string;
	workspaces: { id: string; name: string; role: string; features: string[] }[];
};

type SupportRecord = {
	issueType: SupportIssueType;
	title: string;
	summary: string;
	nextStep: string;
	sensitive: boolean;
};

export const DEMO_ACCOUNT: DemoAccountContext = {
	productName: 'Northstar Cloud',
	customerName: 'Maya Chen',
	email: 'maya.chen@example.com',
	signedIn: true,
	plan: 'Business',
	renewalDate: '2026-08-15',
	lastInvoice: 'INV-2048, paid on 2026-05-18 for $240.00',
	workspaces: [
		{
			id: 'ws_acme_ops',
			name: 'Acme Operations',
			role: 'Member',
			features: ['Projects', 'Automations', 'Reporting']
		},
		{
			id: 'ws_acme_admin',
			name: 'Acme Admin',
			role: 'Viewer',
			features: ['Billing', 'Audit log']
		}
	]
};

export const SUPPORT_RECORDS: Record<SupportIssueType, SupportRecord> = {
	account_access: {
		issueType: 'account_access',
		title: 'Account access',
		summary:
			'The demo account is active and signed in. No account lock or password reset hold is present.',
		nextStep:
			'Have the user confirm which workspace or feature is blocked, then check permissions.',
		sensitive: false
	},
	billing: {
		issueType: 'billing',
		title: 'Billing and invoices',
		summary: 'The Business plan is active. The latest invoice is INV-2048 and is marked paid.',
		nextStep:
			'Ask for the last four characters of the billing email before sharing invoice details.',
		sensitive: true
	},
	feature_access: {
		issueType: 'feature_access',
		title: 'Feature access',
		summary:
			'Analytics dashboard access is limited because the user is a Member in Acme Operations and a Viewer in Acme Admin.',
		nextStep:
			'Ask a workspace admin to grant Reporting Admin or Billing Admin access, depending on the feature.',
		sensitive: false
	},
	permissions: {
		issueType: 'permissions',
		title: 'Workspace permissions',
		summary: 'The user has Member access in Acme Operations and Viewer access in Acme Admin.',
		nextStep: 'Ask for one confirming detail before recommending a role change request.',
		sensitive: true
	},
	security: {
		issueType: 'security',
		title: 'Security and MFA',
		summary: 'MFA is enabled. No suspicious sign-in hold is attached to the demo account.',
		nextStep: 'Ask for one confirming detail before giving reset or recovery instructions.',
		sensitive: true
	},
	subscription: {
		issueType: 'subscription',
		title: 'Subscription',
		summary: 'The account is on the Business plan and renews on 2026-08-15.',
		nextStep: 'Explain current plan status and offer to check billing details after verification.',
		sensitive: false
	},
	general: {
		issueType: 'general',
		title: 'General support',
		summary: 'No specific account issue was detected yet.',
		nextStep: 'Ask a concise clarifying question about the product area or error the user sees.',
		sensitive: false
	}
};

export function classifySupportIssue(input: string): SupportIssueType {
	const text = input.toLowerCase();
	if (/\b(invoice|billing|bill|payment|receipt|charge|card)\b/.test(text)) return 'billing';
	if (/\b(mfa|2fa|two-factor|password|reset|security|locked|sign.?in|login)\b/.test(text)) {
		return 'security';
	}
	if (/\b(permission|role|admin|viewer|member|workspace access)\b/.test(text)) return 'permissions';
	if (/\b(subscription|plan|renew|upgrade|downgrade)\b/.test(text)) return 'subscription';
	if (/\b(access|analytics|dashboard|reporting|feature|cannot open|can't open)\b/.test(text)) {
		return 'feature_access';
	}
	if (/\b(account|profile|email)\b/.test(text)) return 'account_access';
	return 'general';
}
