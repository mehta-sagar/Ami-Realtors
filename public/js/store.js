// Data layer. Works on the phone alone (IndexedDB) and switches to Supabase once signed in.
const DB = 'ami-realtors';
let idbP;
function idb() {
  idbP ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return idbP;
}
async function kvGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function kvSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
async function kvDel(k) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export const PRIVATE = ['customers', 'brokers', 'properties', 'inquiries', 'deals', 'price_points', 'activities', 'tasks', 'area_notes', 'reports'];
export const PUBLIC = ['news', 'market'];
export const DEFAULT_SB_URL = 'https://qzcpydazbhcehjzuvhni.supabase.co';

export const cfg = {
  get(k, d) { const v = localStorage.getItem('ami.' + k); return v == null ? d : JSON.parse(v); },
  set(k, v) { localStorage.setItem('ami.' + k, JSON.stringify(v)); },
  del(k) { localStorage.removeItem('ami.' + k); },
};

let sb = null, session = null;
export const cloud = {
  get ready() { return !!(sb && session); },
  get email() { return session?.user?.email || ''; },
  async init() {
    const url = cfg.get('sbUrl', DEFAULT_SB_URL), key = cfg.get('sbKey', '');
    sb = null; session = null;
    if (!url || !key || !window.supabase) return false;
    try {
      sb = window.supabase.createClient(url, key);
      session = (await sb.auth.getSession()).data.session;
      sb.auth.onAuthStateChange((_e, s) => { session = s; });
    } catch (e) { console.warn(e); sb = null; }
    return this.ready;
  },
  async signIn(email, password, create) {
    if (!sb) throw new Error('Add the Supabase URL and anon key first');
    const r = create ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    if (r.error) throw r.error;
    session = r.data.session;
    if (!session) throw new Error('Check your email to confirm the account, then sign in');
  },
  async signOut() { if (sb) await sb.auth.signOut(); session = null; },
};

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x'.repeat(32).replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));
const localList = async (table) => (await kvGet('tbl:' + table)) || [];

export const store = {
  async list(table) {
    if (cloud.ready) {
      let q = sb.from(table).select('*');
      if (table === 'price_points') q = q.gte('observed_on', new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10));
      if (table === 'news') q = q.order('published_on', { ascending: false }).limit(60);
      if (table === 'market') q = q.order('day', { ascending: false }).limit(1);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
    return localList(table);
  },
  async save(table, rec) {
    const now = new Date().toISOString();
    const row = { ...rec, id: rec.id || uuid(), created_at: rec.created_at || now, updated_at: now };
    if (cloud.ready) {
      const { error } = await sb.from(table).upsert(row);
      if (error) throw error;
    } else {
      const rows = await localList(table), i = rows.findIndex((r) => r.id === row.id);
      if (i >= 0) rows[i] = row; else rows.push(row);
      await kvSet('tbl:' + table, rows);
    }
    return row;
  },
  async remove(table, id) {
    if (cloud.ready) { const { error } = await sb.from(table).delete().eq('id', id); if (error) throw error; }
    else await kvSet('tbl:' + table, (await localList(table)).filter((r) => r.id !== id));
  },
  // Files (photos, documents). Returns a reference string kept on the record.
  async putFile(blob, name) {
    const id = uuid() + '-' + (name || 'file').replace(/[^\w.-]+/g, '_').slice(-40);
    if (cloud.ready) {
      const path = session.user.id + '/' + id;
      const { error } = await sb.storage.from('property-files').upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      return 'sb:' + path;
    }
    await kvSet('file:' + id, blob);
    return 'local:' + id;
  },
  async fileUrl(ref) {
    if (!ref) return null;
    if (ref.startsWith('sb:')) {
      if (!cloud.ready) return null;
      const { data } = await sb.storage.from('property-files').createSignedUrl(ref.slice(3), 3600);
      return data?.signedUrl || null;
    }
    const blob = await kvGet('file:' + ref.slice(6));
    return blob ? URL.createObjectURL(blob) : null;
  },
  async fileBlob(ref) {
    if (!ref) return null;
    if (ref.startsWith('local:')) return kvGet('file:' + ref.slice(6));
    const url = await this.fileUrl(ref);
    return url ? (await fetch(url)).blob() : null;
  },
  async removeFile(ref) {
    if (ref?.startsWith('local:')) await kvDel('file:' + ref.slice(6));
    else if (ref?.startsWith('sb:') && cloud.ready) await sb.storage.from('property-files').remove([ref.slice(3)]);
  },
  // One-time move of phone data into the cloud after first sign-in.
  async uploadLocal() {
    if (!cloud.ready) throw new Error('Sign in first');
    let n = 0;
    for (const table of PRIVATE) {
      const rows = await localList(table);
      for (const r of rows) {
        for (const f of ['photos', 'docs']) if (Array.isArray(r[f])) {
          r[f] = await Promise.all(r[f].map(async (ref) => {
            if (!ref.startsWith('local:')) return ref;
            const blob = await kvGet('file:' + ref.slice(6));
            return blob ? this.putFile(blob, ref.slice(43)) : ref;
          }));
        }
        const { error } = await sb.from(table).upsert(r);
        if (error) throw error;
        n++;
      }
      if (rows.length) await kvSet('tbl:' + table, []);
    }
    return n;
  },
};

// PIN and Face ID gate. The check happens on the phone itself.
async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const lock = {
  get hasPin() { return !!cfg.get('pin', null); },
  get hasFace() { return !!cfg.get('faceId', null); },
  async setPin(pin) { const salt = uuid(); cfg.set('pin', { salt, hash: await sha(salt + pin) }); },
  clear() { cfg.del('pin'); cfg.del('faceId'); },
  async checkPin(pin) { const p = cfg.get('pin', null); return !!p && (await sha(p.salt + pin)) === p.hash; },
  async enableFace() {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Ami Realtors' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'owner', displayName: 'Ami Realtors' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    } });
    cfg.set('faceId', b64(cred.rawId));
  },
  async checkFace() {
    const id = cfg.get('faceId', null);
    if (!id) return false;
    try {
      const r = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(id) }],
        userVerification: 'required', timeout: 60000,
      } });
      return !!r;
    } catch { return false; }
  },
};
