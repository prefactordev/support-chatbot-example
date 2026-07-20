import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEMO_ACCOUNT, SUPPORT_RECORDS, classifySupportIssue } from './support-tools.ts';

test('classifies common SaaS support intents', () => {
	assert.equal(classifySupportIssue('I cannot access the analytics dashboard'), 'feature_access');
	assert.equal(classifySupportIssue('Please send me my last invoice'), 'billing');
	assert.equal(classifySupportIssue('Can you reset my MFA?'), 'security');
	assert.equal(classifySupportIssue('Do I have admin permissions?'), 'permissions');
});

test('returns fixed signed-in demo account context', () => {
	assert.equal(DEMO_ACCOUNT.customerName, 'Maya Chen');
	assert.equal(DEMO_ACCOUNT.productName, 'Northstar Cloud');
	assert.equal(DEMO_ACCOUNT.signedIn, true);
	assert.equal(DEMO_ACCOUNT.workspaces[0]?.name, 'Acme Operations');
});

test('requires light verification for sensitive support issues', () => {
	assert.equal(SUPPORT_RECORDS.billing.sensitive, true);
	assert.equal(SUPPORT_RECORDS.security.sensitive, true);
	assert.equal(SUPPORT_RECORDS.permissions.sensitive, true);
	assert.equal(SUPPORT_RECORDS.feature_access.sensitive, false);
});

test('returns support records with actionable next step', () => {
	const record = SUPPORT_RECORDS.feature_access;

	assert.equal(record.issueType, 'feature_access');
	assert.match(record.summary, /Analytics dashboard/);
	assert.match(record.nextStep, /workspace admin/);
});
