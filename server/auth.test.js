// Smoke tests for the auth middleware + request helpers (server/auth.js).
// Run with: npm test  (uses Node's built-in test runner — no extra deps).
// These cover the offline-verifiable paths: the no-token / malformed-header
// guards (which short-circuit before Firebase is ever called) and the pure
// IP / Cloudinary-URL helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdmin, verifySuperAdmin, getClientIp, getPublicIdFromUrl } from './auth.js';

function mockRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

test('verifyAdmin rejects a request with no Authorization header (401)', async () => {
  const res = mockRes();
  let nextCalled = false;
  await verifyAdmin({ headers: {} }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('verifyAdmin rejects a non-Bearer Authorization header (401)', async () => {
  const res = mockRes();
  let nextCalled = false;
  await verifyAdmin({ headers: { authorization: 'Basic Zm9v' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('verifySuperAdmin rejects a request with no Authorization header (401)', async () => {
  const res = mockRes();
  let nextCalled = false;
  await verifySuperAdmin({ headers: {} }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('getClientIp returns the first public IP in the X-Forwarded-For chain', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' }, ip: '10.0.0.2' };
  assert.equal(getClientIp(req), '203.0.113.7');
});

test('getClientIp prefers a platform real-client header over XFF', () => {
  const req = { headers: { 'cf-connecting-ip': '198.51.100.5', 'x-forwarded-for': '203.0.113.7' }, ip: '10.0.0.1' };
  assert.equal(getClientIp(req), '198.51.100.5');
});

test('getClientIp normalizes an IPv6-mapped IPv4 socket address', () => {
  assert.equal(getClientIp({ headers: {}, ip: '::ffff:192.0.2.50' }), '192.0.2.50');
});

test('getPublicIdFromUrl derives the id from an optimized Cloudinary URL', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,f_auto,q_auto/v1700000000/team-rotor/abc.jpg';
  assert.equal(getPublicIdFromUrl(url), 'team-rotor/abc');
});

test('getPublicIdFromUrl returns null for non-Cloudinary URLs', () => {
  assert.equal(getPublicIdFromUrl('https://example.com/foo.png'), null);
});
