'use strict';
require('dotenv').config?.();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, '.data.json');
const DEFAULT = {
  version: 1,
  settings: { region: 'EUROPE', tagline: 'MORE THAN JUST A TEAM', language: 'en', theme: 'red', mode: 'dark', socials: { telegram: '', tiktok: '', twitch: '', steam: '' } },
  stats: [{ label: 'Rating 3.0', value: '1.28' }, { label: 'Winrate', value: '72%' }, { label: 'Entrying', value: '1.12' }, { label: 'Utility', value: '4.3' }],
  players: [
    { id:'p1', nick:'PLAYER ONE', role:'RIFLER', country:'EU', rating:'1.28', photo:'', note:'', active:true },
    { id:'p2', nick:'PLAYER TWO', role:'AWPer', country:'EU', rating:'1.16', photo:'', note:'', active:true },
    { id:'p3', nick:'PLAYER THREE', role:'IGL', country:'EU', rating:'1.10', photo:'', note:'', active:true },
    { id:'p4', nick:'PLAYER FOUR', role:'RIFLER', country:'EU', rating:'1.09', photo:'', note:'', active:true },
    { id:'p5', nick:'PLAYER FIVE', role:'SUPPORT', country:'EU', rating:'1.04', photo:'', note:'', active:true }
  ],
  news: [], matches: [], highlights: [],
  copy: { en: { news:'LATEST NEWS', roster:'THE ROSTER', stats:'TEAM STATISTICS', matches:'MATCH HISTORY', highlights:'HIGHLIGHTS', viewAll:'VIEW ALL', emptyNews:'No news yet.', emptyMatches:'No matches added yet.', emptyHighlights:'No highlights added yet.' }, ru: { news:'ПОСЛЕДНИЕ НОВОСТИ', roster:'СОСТАВ', stats:'СТАТИСТИКА КОМАНДЫ', matches:'МАТЧИ', highlights:'ХАЙЛАЙТЫ', viewAll:'СМОТРЕТЬ ВСЁ', emptyNews:'Новостей пока нет.', emptyMatches:'Матчи пока не добавлены.', emptyHighlights:'Хайлайты пока не добавлены.' } }
};
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(session({
  name: 'k7.sid', secret: process.env.SESSION_SECRET || 'dev-only-change-me', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const ok = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/.test(file.mimetype);
  cb(ok ? null : new Error('Only JPG, PNG, WEBP, GIF, MP4 or WEBM files are allowed.'), ok);
}});
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
function cleanContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid content payload');
  const merged = structuredClone(DEFAULT);
  for (const key of ['settings','stats','players','news','matches','highlights','copy']) if (input[key] !== undefined) merged[key] = input[key];
  merged.version = 1;
  if (!merged.settings || typeof merged.settings !== 'object') merged.settings = structuredClone(DEFAULT.settings);
  for (const k of ['players','news','matches','highlights','stats']) if (!Array.isArray(merged[k])) merged[k] = [];
  if (merged.players.length > 30 || merged.news.length > 100 || merged.matches.length > 100 || merged.highlights.length > 100) throw new Error('Too many items');
  return merged;
}
async function readContent() {
  if (supabase) {
    const { data, error } = await supabase.from('k7_site_content').select('content').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (data?.content && data.content.version) return cleanContent(data.content);
    await writeContent(DEFAULT); return structuredClone(DEFAULT);
  }
  try { return cleanContent(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
  catch { return structuredClone(DEFAULT); }
}
async function writeContent(content) {
  const safe = cleanContent(content);
  if (supabase) {
    const { error } = await supabase.from('k7_site_content').upsert({ id: 1, content: safe, updated_at: new Date().toISOString() });
    if (error) throw error;
  } else fs.writeFileSync(DATA_FILE, JSON.stringify(safe, null, 2));
  return safe;
}
function admin(req, res, next) { if (req.session?.isAdmin) return next(); return res.status(401).json({ error: 'Admin login required' }); }
app.get('/api/health', (_req, res) => res.json({ ok: true, persistence: supabase ? 'supabase' : 'local-file', configured: !!(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET) }));
app.get('/api/content', async (_req, res) => { try { res.set('Cache-Control','no-store'); res.json(await readContent()); } catch (e) { console.error(e); res.status(503).json({ error: 'Could not load site content' }); } });
app.get('/api/session', (req, res) => res.json({ authenticated: !!req.session?.isAdmin }));
app.post('/api/login', loginLimiter, (req, res) => {
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'dev-only-change-me') return res.status(503).json({ error: 'Admin is not configured. Set ADMIN_PASSWORD and SESSION_SECRET in environment variables.' });
  const given = String(req.body?.password || '');
  const expected = process.env.ADMIN_PASSWORD;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Incorrect password' });
  req.session.regenerate(err => { if (err) return res.status(500).json({ error: 'Could not create session' }); req.session.isAdmin = true; req.session.save(err2 => err2 ? res.status(500).json({ error: 'Could not save session' }) : res.json({ ok: true })); });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => { res.clearCookie('k7.sid'); res.json({ ok: true }); }));
app.put('/api/content', admin, async (req, res) => { try { const saved = await writeContent(req.body); res.json({ ok: true, content: saved }); } catch (e) { console.error(e); res.status(400).json({ error: e.message || 'Save failed' }); } });
app.post('/api/upload', admin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file first.' });
    const ext = (req.file.originalname.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0,8) || 'bin';
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    if (!supabase) return res.status(503).json({ error: 'Uploads require Supabase. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
    const bucket = process.env.SUPABASE_BUCKET || 'k7-media';
    const { error } = await supabase.storage.from(bucket).upload(name, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(name);
    res.json({ url: data.publicUrl, name });
  } catch (e) { console.error(e); res.status(400).json({ error: e.message || 'Upload failed' }); }
});
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, _req, res, _next) => { console.error(err); res.status(400).json({ error: err.message || 'Request failed' }); });
app.listen(PORT, () => console.log(`K7 ESPORTS listening on ${PORT}; persistence=${supabase ? 'Supabase' : 'local file'}`));
