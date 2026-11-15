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

let sb = null, session = null, team = null, chan = null;
// Built in so nobody has to paste keys: the publishable key is safe in an app (row-level security protects the data).
export const SB_PUBLIC_KEY = 'sb_publishable_LBFkjCG99kfNQBPHuw_xxQ_bBdmIw-u';
export const cloud = {
  get ready() { return !!(sb && session); },
  get email() { return session?.user?.email || ''; },
  get uid() { return session?.user?.id || null; },
  get team() { return team; },
  get isOwner() { return !team || !team.role || team.role === 'owner'; },
  get client() { return sb; },
  async init() {
    const url = cfg.get('sbUrl', DEFAULT_SB_URL) || DEFAULT_SB_URL, key = cfg.get('sbKey', '') || SB_PUBLIC_KEY;
    sb = null; session = null; team = null;
    if (!window.supabase) return false;
    try {
      const hash = location.hash || '';
      this.recovery = /type=recovery/.test(hash);
      this.linkError = (hash.match(/error_description=([^&]+)/) || [])[1] ? decodeURIComponent(hash.match(/error_description=([^&]+)/)[1].replace(/\+/g, ' ')) : null;
      sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      session = (await sb.auth.getSession()).data.session;
      sb.auth.onAuthStateChange((ev, s) => { session = s; if (ev === 'PASSWORD_RECOVERY') this.recovery = true; });
      if (/access_token|error_description|type=/.test(hash)) await new Promise((r) => setTimeout(r, 300));
      if (session) await this.loadTeam();
    } catch (e) { console.warn(e); }
    return this.ready;
  },
  async loadTeam() {
    try {
      const { data, error } = await sb.rpc('team_me');
      if (!error) team = data;
      else if (/team_me|function|schema cache/i.test(error.message)) team = { missing: true }; // database not updated to v3 yet
      else team = cfg.get('team', null) || { offline: true };
    } catch { team = cfg.get('team', null) || { offline: true }; }
    if (team) cfg.set('team', team);
    return team;
  },
  async signIn(email, password, create) {
    if (!sb) await this.init();
    if (!sb) throw new Error('Cloud library did not load. Check the internet and reopen the app.');
    const r = create ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/' } }) : await sb.auth.signInWithPassword({ email, password });
    if (r.error) throw r.error;
    session = r.data.session;
    if (!session) throw new Error('CONFIRM_EMAIL');
    await this.loadTeam();
  },
  async token() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session ? data.session.access_token : null; },
  async setPassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; this.recovery = false; },
  async resendConfirm(email) { const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + '/' } }); if (error) throw error; },
  async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }); if (error) throw error; },
  async createTeam(name, person) { const { data, error } = await sb.rpc('create_team', { p_name: name, p_person: person }); if (error) throw error; team = data; cfg.set('team', team); return team; },
  async joinTeam(code, person) { const { data, error } = await sb.rpc('join_team', { p_code: code, p_person: person }); if (error) throw error; team = data; cfg.set('team', team); return team; },
  async backupStatus() { const { data, error } = await sb.rpc('backup_status'); if (error) throw error; return data; },
  async backupNow() { const { data, error } = await sb.rpc('backup_now'); if (error) throw error; return data; },
  async invite(role) { const { data, error } = await sb.rpc('make_invite', { p_role: role }); if (error) throw error; return data; },
  async members() { const { data, error } = await sb.from('team_members').select('*').order('created_at'); if (error) throw error; return data; },
  async setRole(userId, role) { const { error } = await sb.from('team_members').update({ role }).eq('user_id', userId).eq('team_id', team.team_id); if (error) throw error; },
  async signOut() { this.unlisten(); if (sb) await sb.auth.signOut(); session = null; team = null; cfg.del('team'); },
  // Live sync: every insert / update / delete by anyone in the team arrives here within a second or two.
  listen(tables, onChange) {
    this.unlisten();
    if (!this.ready) return;
    chan = sb.channel('ami-live');
    for (const table of tables) chan.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => onChange(table, p.eventType, p.new, p.old));
    chan.subscribe((status) => { cloud.live = status === 'SUBSCRIBED'; if (cloud.onStatus) cloud.onStatus(status); });
  },
  unlisten() { if (chan && sb) { sb.removeChannel(chan); } chan = null; cloud.live = false; },
};

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x'.repeat(32).replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));
const localList = async (table) => (await kvGet('tbl:' + table)) || [];

// Saves keep working before the v3 database update: unknown columns are dropped and the save is retried.
async function upsertLoose(table, row) {
  // owner / team are set by the database (a teammate editing my customer must not take it over)
  let r = { ...row }; delete r.owner; delete r.team_id; delete r.updated_by;
  for (let i = 0; i < 6; i++) {
    const { error } = await sb.from(table).upsert(r);
    if (!error) return r;
    const m = /'([a-z_]+)' column|column "?([a-z_]+)"? (?:of relation \S+ )?does not exist/i.exec(error.message || '');
    const col = m && (m[1] || m[2]);
    if (!col || !(col in r)) throw error;
    delete r[col];
  }
  throw new Error('save failed');
}
export const store = {
  async list(table) {
    if (cloud.ready) {
      try {
        let q = sb.from(table).select('*');
        if (table === 'price_points') q = q.gte('observed_on', new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10));
        if (table === 'news') q = q.order('published_on', { ascending: false }).limit(60);
        if (table === 'market') q = q.order('day', { ascending: false }).limit(1);
        const { data, error } = await q;
        if (error) throw error;
        kvSet('cache:' + table, data).catch(() => {});
        return data;
      } catch (e) {
        // offline: show the last copy from this phone
        const c = await kvGet('cache:' + table).catch(() => null);
        if (c) { cloud.offline = true; return c; }
        throw e;
      }
    }
    return localList(table);
  },
  async save(table, rec) {
    const now = new Date().toISOString();
    const row = { ...rec, id: rec.id || uuid(), created_at: rec.created_at || now, updated_at: now };
    if (cloud.ready) {
      const saved = await upsertLoose(table, row);
      return { ...row, ...saved };
    }
    const rows = await localList(table), i = rows.findIndex((r) => r.id === row.id);
    if (i >= 0) rows[i] = row; else rows.push(row);
    await kvSet('tbl:' + table, rows);
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
  async hasLocal() { for (const t of PRIVATE) if ((await localList(t)).length) return true; return false; },
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
        await upsertLoose(table, r);
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

// ---------- Backups kept on this phone (a second copy, outside the cloud) ----------
// One full copy a day, the last 14 days. Survives even if the cloud account is lost.
export const localBackup = {
  async list() { return ((await kvGet('backups').catch(() => null)) || []).sort((a, b) => String(b.at).localeCompare(String(a.at))); },
  async take(data, force) {
    const all = await this.list(), day = new Date().toISOString().slice(0, 10);
    if (!force && all.some((b) => String(b.at).slice(0, 10) === day)) return null;
    const snap = { at: new Date().toISOString(), counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
    await kvSet('backup:' + snap.at, data);
    const keep = [snap, ...all].slice(0, 14);
    for (const old of all.slice(13)) await kvDel('backup:' + old.at).catch(() => {});
    await kvSet('backups', keep);
    return snap;
  },
  async get(at) { return kvGet('backup:' + at); },
};
