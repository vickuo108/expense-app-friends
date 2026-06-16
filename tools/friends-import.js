#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FIREBASE_API_KEY = 'AIzaSyB1b6oTHXkYj1TfZJvwKqfD0Lcim49Bhjk';
const FIREBASE_PROJECT_ID = 'expense-c7e01';
const CLOUD_DOC = 'friends-main';

function usage() {
  console.log(`Usage:
  node tools/friends-import.js --input import.json --out backup.json
  FRIENDS_EMAIL=... FRIENDS_PASSWORD=... node tools/friends-import.js --input import.json --cloud

Input format:
  {
    "date": "2026-06-16",
    "source": "Vic weekly summary 2026-06-09~2026-06-15",
    "defaultMethod": "無",
    "records": [
      {"main":"主食","sub":"晚餐","amount":3271,"note":"optional"}
    ]
  }
`);
}

function parseArgs(argv) {
  const args = { cloud: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--cloud') args.cloud = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function assertDate(s, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function normalizeAmount(v) {
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid positive amount: ${v}`);
  return -Math.round(n);
}

function loadImport(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const date = raw.date || localDateStr();
  assertDate(date, 'date');
  if (!Array.isArray(raw.records) || raw.records.length === 0) {
    throw new Error('records must be a non-empty array');
  }
  const defaultMethod = raw.defaultMethod || '無';
  const source = typeof raw.source === 'string' ? raw.source : 'Vic AI 匯入';
  const records = raw.records
    .filter(r => Number(String(r.amount).replace(/,/g, '')) > 0)
    .map(r => ({
      id: genId(),
      date: r.date || date,
      type: r.type || '費用',
      method: r.method || defaultMethod,
      main: r.main || '',
      sub: r.sub || '',
      amount: normalizeAmount(r.amount),
      note: [r.note, source].filter(Boolean).join('｜'),
    }));
  records.forEach(r => assertDate(r.date, 'record.date'));
  return { input: raw, records };
}

function mergeRecords(existing, incoming) {
  const seen = new Set(existing.map(r => [
    r.date,
    r.type,
    r.method,
    r.main,
    r.sub,
    r.amount,
    r.note || '',
  ].join('|')));
  const added = [];
  for (const r of incoming) {
    const key = [r.date, r.type, r.method, r.main, r.sub, r.amount, r.note || ''].join('|');
    if (!seen.has(key)) {
      existing.push(r);
      seen.add(key);
      added.push(r);
    }
  }
  return added;
}

function buildBackup(importData) {
  return {
    records: importData.records,
    methods_grouped: { '現金': ['現金'] },
    categories: {},
    income_cats: [],
    fixed: [],
    loans: [],
    loan_prin: {},
    acct_bal: {},
    acct_avail: {},
    cc_due: {},
    cc_limits: [],
    fin_plan: [],
    monthly_budgets: {},
    app_name: '',
    import_source: importData.input.source || 'Vic AI 匯入',
  };
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

async function signIn(email, password) {
  const data = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  return { uid: data.localId, idToken: data.idToken };
}

function firestoreDocUrl(uid) {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/data/${CLOUD_DOC}`;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)])) } };
  }
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}

function fromFirestoreValue(v) {
  if (!v) return undefined;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) {
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, val]) => [k, fromFirestoreValue(val)]));
  }
  return undefined;
}

function firestoreToPlain(doc) {
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)]));
}

function plainToFirestore(data) {
  return { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)])) };
}

async function importToCloud(importData) {
  const email = process.env.FRIENDS_EMAIL;
  const password = process.env.FRIENDS_PASSWORD;
  if (!email || !password) throw new Error('Set FRIENDS_EMAIL and FRIENDS_PASSWORD before using --cloud');
  const auth = await signIn(email, password);
  let cloud = {};
  try {
    const doc = await requestJson(firestoreDocUrl(auth.uid), {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });
    cloud = firestoreToPlain(doc);
  } catch (err) {
    if (!String(err.message).includes('NOT_FOUND')) throw err;
  }
  const existing = Array.isArray(cloud.records) ? cloud.records : [];
  const added = mergeRecords(existing, importData.records);
  cloud.records = existing;
  await requestJson(firestoreDocUrl(auth.uid), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${auth.idToken}` },
    body: JSON.stringify(plainToFirestore(cloud)),
  });
  return added;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const importData = loadImport(args.input);
  if (args.cloud) {
    const added = await importToCloud(importData);
    console.log(JSON.stringify({ status: 'cloud_imported', added: added.length }, null, 2));
    return;
  }
  const out = args.out || path.resolve(process.cwd(), `friends_import_${localDateStr()}.json`);
  fs.writeFileSync(out, JSON.stringify(buildBackup(importData), null, 2));
  console.log(JSON.stringify({ status: 'backup_created', out, records: importData.records.length }, null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
