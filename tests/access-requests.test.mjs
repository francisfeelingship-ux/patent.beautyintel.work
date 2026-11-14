import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.ts';
import { verifiedAdminEmail } from '../src/access-control.ts';

function fakeDb() {
  const applications = new Map();
  return {
    applications,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async run() {
          if (!sql.includes('INSERT OR IGNORE INTO access_requests')) throw new Error(sql);
          if (![...applications.values()].some(r => r.email === args[2])) {
            applications.set(args[0], { id: args[0], full_name: args[1], email: args[2],
              organization: args[3], use_case: args[4], message: args[5], status: 'pending' });
          }
          return { success: true };
        },
        async all() {
          if (sql.includes('SELECT status, COUNT(*)')) {
            return { results: [{ status: 'pending', count: applications.size }] };
          }
          if (sql.includes('FROM access_requests')) return { results: [...applications.values()] };
          throw new Error(sql);
        },
        async first() {
          if (!sql.includes('UPDATE access_requests')) throw new Error(sql);
          const record = applications.get(args[3]);
          if (!record || record.status !== 'pending') return null;
          record.status = args[0];
          record.review_note = args[1];
          record.reviewed_by = args[2];
          return { id: record.id, status: record.status, email: record.email };
        },
      };
    },
  };
}

function postApplication(data, options = {}) {
  return new Request('https://patents.beautyintel.work/api/access-requests', {
    method: 'POST',
    headers: { Origin: 'https://patents.beautyintel.work', 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(data),
  });
}

const validApplication = {
  fullName: 'Sample Applicant', email: '  Applicant@Example.com ', organization: 'Beauty Research Ltd',
  useCase: 'ingredients', message: 'I want to see the patent landscape', website: '',
};

test('public application form is self-contained, but the rest of the patent API is unchanged', async () => {
  const result = await worker.fetch(new Request('https://patents.beautyintel.work/apply'), { DB: fakeDb() }, {});
  assert.equal(result.status, 200);
  assert.match(await result.text(), /申请访问权限/);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('valid applicant is stored once, duplicate submissions do not reveal existence', async () => {
  const db = fakeDb();
  const one = await worker.fetch(postApplication(validApplication), { DB: db }, {});
  const two = await worker.fetch(postApplication(validApplication), { DB: db }, {});
  assert.equal(one.status, 202);
  assert.equal(two.status, 202);
  assert.deepEqual(await one.json(), await two.json());
  assert.equal(db.applications.size, 1);
  assert.equal([...db.applications.values()][0].email, 'applicant@example.com');
});

test('spam trap and bad submissions never insert data', async () => {
  const db = fakeDb();
  const spam = await worker.fetch(postApplication({ ...validApplication, website: 'http://spam' }), { DB: db }, {});
  assert.equal(spam.status, 202);
  const invalid = await worker.fetch(postApplication({ ...validApplication, email: 'bad-email' }), { DB: db }, {});
  assert.equal(invalid.status, 400);
  const origin = await worker.fetch(postApplication(validApplication, { headers: { Origin: 'https://evil.example' } }), { DB: db }, {});
  assert.equal(origin.status, 403);
  assert.equal(db.applications.size, 0);
});

test('a forged email header cannot bypass JWT administrator verification', async () => {
  const db = fakeDb();
  const req = new Request('https://patents.beautyintel.work/api/admin/applications', {
    headers: { 'Cf-Access-Authenticated-User-Email': 'null.pointer@zoho.com' },
  });
  const result = await worker.fetch(req, { DB: db }, {});
  assert.equal(result.status, 401);
});

test('signed Cloudflare Access JWT permits list and one-time approval, rejects repeats', async () => {
  const keyPair = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['sign', 'verify']);
  const publicJwk = { ...await crypto.subtle.exportKey('jwk', keyPair.publicKey), kid: 'test-key' };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
  const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  const header = b64({ alg: 'RS256', kid: 'test-key' });
  const payload = b64({ email: 'null.pointer@zoho.com', iss: 'https://snowy-tree-57a8.cloudflareaccess.com',
    aud: ['cf7e08f694dadd97e97a2a5160b2ebee32810a7f61ba44e9d307a1524cdb3447'],
    exp: Math.floor(Date.now() / 1000) + 300 });
  const message = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(message)));
  const token = `${message}.${Buffer.from(signature).toString('base64url')}`;
  const authHeaders = { 'Cf-Access-Jwt-Assertion': token };

  try {
    const db = fakeDb();
    await worker.fetch(postApplication(validApplication), { DB: db }, {});
    const list = await worker.fetch(new Request('https://patents.beautyintel.work/api/admin/applications', { headers: authHeaders }), { DB: db }, {});
    assert.equal(list.status, 200);
    assert.equal((await list.json()).applications.length, 1);

    const id = [...db.applications.keys()][0];
    const approve = () => new Request(`https://patents.beautyintel.work/api/admin/applications/${id}/decision`, {
      method: 'POST',
      headers: { ...authHeaders, Origin: 'https://patents.beautyintel.work', 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved', note: 'Valid organization' }),
    });
    const result = await worker.fetch(approve(), { DB: db }, {});
    assert.equal(result.status, 200);
    assert.equal((await result.json()).accessProvisioned, false);
    assert.equal((await worker.fetch(approve(), { DB: db }, {})).status, 409);

    const forged = token.replace(/.$/, token.endsWith('A') ? 'B' : 'A');
    assert.equal(await verifiedAdminEmail(new Request('https://patents.beautyintel.work/admin/applications', {
      headers: { 'Cf-Access-Jwt-Assertion': forged },
    })), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
