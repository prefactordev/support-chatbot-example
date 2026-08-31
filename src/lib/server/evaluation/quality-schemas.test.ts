import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUALITY_SCHEMAS } from './quality-schemas.ts';

type PayloadSchema = {
	type: string;
	properties: Record<
		string,
		{
			type: string;
			'prefactor:format'?: string;
			enum?: (string | number)[];
			title?: string;
			description?: string;
		}
	>;
	required: string[];
	additionalProperties: boolean;
};

test('defines one quality schema per evaluation dimension', () => {
	assert.deepEqual(
		QUALITY_SCHEMAS.map((schema) => schema.name),
		['resolution', 'helpfulness', 'coherence', 'user_friction']
	);
});

test('each quality schema declares a strict, human-readable payload contract', () => {
	for (const schema of QUALITY_SCHEMAS) {
		assert.equal(typeof schema.title, 'string');
		assert.equal(typeof schema.description, 'string');
		assert.equal(typeof schema.template, 'string');

		const payload = schema.schema as PayloadSchema;
		assert.equal(payload.type, 'object');
		assert.equal(payload.additionalProperties, false);
		assert.deepEqual(payload.required, ['score', 'verdict', 'explanation']);

		assert.equal(payload.properties.score.type, 'number');
		assert.deepEqual(payload.properties.score.enum, [0, 1]);
		assert.equal(payload.properties.verdict.type, 'string');
		assert.equal(payload.properties.verdict.enum?.length, 2);
		assert.equal(payload.properties.explanation.type, 'string');
		assert.equal(payload.properties.explanation['prefactor:format'], 'markdown');

		for (const field of Object.values(payload.properties)) {
			assert.equal(typeof field.title, 'string');
			assert.equal(typeof field.description, 'string');
		}
	}
});

test('verdict enums match the evaluator choices', () => {
	const byName = new Map(QUALITY_SCHEMAS.map((schema) => [schema.name, schema]));
	const verdictEnum = (name: string) =>
		(byName.get(name)?.schema as PayloadSchema).properties.verdict.enum;

	assert.deepEqual(verdictEnum('resolution'), ['resolved', 'not_resolved']);
	assert.deepEqual(verdictEnum('helpfulness'), ['helpful', 'unhelpful']);
	assert.deepEqual(verdictEnum('coherence'), ['coherent', 'incoherent']);
	assert.deepEqual(verdictEnum('user_friction'), ['not_frustrated', 'frustrated']);
});
