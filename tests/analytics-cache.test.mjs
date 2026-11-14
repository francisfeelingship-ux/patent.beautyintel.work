import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.ts';

function fakeDatabase() {
  const snapshots = new Map();
  const statements = [];
  return {
    snapshots,
    statements,
    prepare(sql) {
      statements.push(sql.trim());
      let args = [];
      return {
        bind(...params) {
          args = params;
          return this;
        },
        async first() {
          if (sql.includes('FROM analytics_snapshots')) {
            const payload = snapshots.get(args[0]);
            return payload ? { payload } : null;
          }
          if (sql.includes('COUNT(*) as cnt')) return { cnt: 42 };
          throw new Error(`Unexpected first query: ${sql}`);
        },
        async all() { return { results: [] }; },
        async run() {
          if (!sql.includes('INSERT INTO analytics_snapshots')) {
            throw new Error(`Unexpected write: ${sql}`);
          }
          snapshots.set(args[0], args[1]);
          return { success: true };
        },
      };
    },
  };
}

test('analytics aggregates are computed once, then read from D1 snapshot', async () => {
  const db = fakeDatabase();
  const env = { DB: db };
  const request = new Request('https://patents.beautyintel.work/api/analytics');

  const first = await worker.fetch(request, env, {});
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('X-Analytics-Source'), 'generated');
  assert.equal((await first.json()).global.total_patents, 42);
  const afterFirst = db.statements.length;
  assert.ok(db.statements.some(sql => sql.includes('COUNT(*) as cnt FROM families')));
  assert.equal(db.snapshots.size, 1);

  const second = await worker.fetch(request, env, {});
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('X-Analytics-Source'), 'snapshot');
  assert.equal((await second.json()).global.total_patents, 42);
  assert.equal(db.statements.length, afterFirst + 1);
  assert.ok(db.statements.at(-1).includes('FROM analytics_snapshots'));
});

test('rejects malformed company filters before expensive queries', async () => {
  const db = fakeDatabase();
  const response = await worker.fetch(
    new Request('https://patents.beautyintel.work/api/analytics?company=%25'),
    { DB: db },
    {},
  );
  assert.equal(response.status, 400);
  assert.equal(db.statements.length, 0);
});

test('HEAD and non-GET API requests never query D1', async () => {
  const db = fakeDatabase();
  for (const [method, expected] of [['HEAD', 200], ['POST', 405]]) {
    const response = await worker.fetch(
      new Request('https://patents.beautyintel.work/api/analytics', { method }),
      { DB: db },
      {},
    );
    assert.equal(response.status, expected);
  }
  assert.equal(db.statements.length, 0);
});

test('family detail resolves public patent numbers through existing indexed columns', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      statements.push(sql);
      let args = [];
      return {
        bind(...params) { args = params; return this; },
        async first() {
          if (sql.includes('FROM publications WHERE publication_number_normalized')) {
            assert.equal(args[0], 'US1234567B2');
            return { publication_number: 'US1234567B2', family_id: 'FAM_TEST' };
          }
          if (sql.includes('FROM families WHERE family_id')) {
            return args[0] === 'FAM_TEST'
              ? { family_id: 'FAM_TEST', display_title: 'Test', member_count: 1 }
              : null;
          }
          throw new Error(`Unexpected lookup: ${sql}`);
        },
        async all() { return { results: [] }; },
      };
    },
  };
  const response = await worker.fetch(
    new Request('https://patents.beautyintel.work/api/family/US-1234567-B2'),
    { DB: db },
    {},
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).family_id, 'FAM_TEST');
  assert.ok(statements.some(sql => sql.includes('publication_number_normalized = ?')));
  assert.ok(statements.every(sql => !sql.includes(' OR ')));
});
