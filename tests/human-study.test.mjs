import test from 'node:test';
import assert from 'node:assert/strict';
import { columns, parseAttempts, analyzeStudy, studyMarkdown } from '../scripts/analyze-human-study.mjs';

// Artificial unit-test arithmetic fixtures; never written to the real-participant collection file.
const row = (extra = {}) => ({ participant_id: 'P01', session_id: 'S1', camera: 'Camera A', lighting: 'normal', clothing: 'fitted', posture: 'upright', target: 'held-60', metric: 'shoulder_left_deg', attempt: '1', measured_at: '2026-11-15T01:00:00Z', app_value: '61', reference_value: '60', reference_method: 'goniometer_included_angle', status: 'success', failure_reason: '', ...extra });

test('empty collection template reports pending, missing errors and zero real participants', () => {
  const result = analyzeStudy(parseAttempts(columns.join(',') + '\n'));
  assert.match(result.status, /PENDING/); assert.equal(result.realParticipants, 0); assert.equal(result.totalAttempts, 0);
  assert.equal(result.metrics.shoulder_left_deg.meanAbsoluteError, null);
  assert.equal(result.metrics.thigh_breadth_cm.failureRate, null);
  assert.match(studyMarkdown(result), /Not available/);
});

test('error estimates use successful paired captures while failure rate keeps failed attempts', () => {
  const report = analyzeStudy([row(), row({ attempt: '2', app_value: '59' }), row({ attempt: '3', status: 'failed', app_value: '', failure_reason: 'Too few confident frames' }), row({ attempt: '4', reference_value: '' })]);
  const m = report.metrics.shoulder_left_deg;
  assert.equal(m.attempts, 4); assert.equal(m.paired, 2); assert.equal(m.failures, 1); assert.equal(m.failureRate, .25);
  assert.equal(m.successfulWithoutReference, 1); assert.equal(m.meanAbsoluteError, 1); assert.equal(m.rootMeanSquaredError, 1); assert.equal(m.captureWeightedBias, 0);
  assert.equal(report.failedCaptures[0].failure_reason, 'Too few confident frames');
  assert.equal(m.by.camera['Camera A'].failures, 1);
});

test('participant weighting and repeatability groups do not inflate people from repeated captures', () => {
  const report = analyzeStudy([row({ app_value: '63' }), row({ attempt: '2', app_value: '63' }), row({ attempt: '3', app_value: '63' }), row({ participant_id: 'P02', app_value: '57' }), row({ session_id: 'S2', lighting: 'dim', app_value: '60' })]);
  const m = report.metrics.shoulder_left_deg;
  assert.equal(report.realParticipants, 2); assert.equal(m.withinSessionRepeatability.length, 1); assert.equal(m.withinSessionRepeatability[0].appSD, 0);
  assert.equal(m.betweenSessionMeans.length, 0); // lighting changed: never called a matching repeated session
  assert.notEqual(m.participantWeightedBias, m.captureWeightedBias);
  const repeated = analyzeStudy([row(), row({ session_id: 'S2', app_value: '64' })]).metrics.shoulder_left_deg;
  assert.equal(repeated.betweenSessionMeans[0].sessionMeanRange, 3);
});

test('CSV retains quoted failure reasons and rejects malformed, duplicated or mismatched measurements', () => {
  const values = columns.map(k => k === 'failure_reason' ? '"Camera blocked,\nfeet cropped"' : k === 'status' ? 'failed' : k === 'app_value' ? '' : row()[k]);
  const parsed = parseAttempts(columns.join(',') + '\r\n' + values.join(','));
  assert.equal(parsed[0].failure_reason, 'Camera blocked,\nfeet cropped');
  assert.equal(analyzeStudy(parsed).totalAttempts, 1);
  assert.throws(() => parseAttempts(columns.join(',') + '\n"unclosed'), /Unclosed/);
  assert.throws(() => analyzeStudy([row(), row()]), /Duplicate/);
  assert.throws(() => analyzeStudy([row({ app_value: '' })]), /missing is not zero/);
  assert.throws(() => analyzeStudy([row({ app_value: 'NaN' })]), /range/);
  assert.throws(() => analyzeStudy([row({ metric: 'thigh_breadth_cm', reference_method: 'tape_circumference' })]), /matching reference/);
  assert.throws(() => analyzeStudy([row({ measured_at: '2026-11-15T01:00:00' })]), /timezone/);
});
