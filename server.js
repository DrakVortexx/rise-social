'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Pool, types } = require('pg');

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(__dirname, '.env'));
  } catch (error) {}
}

types.setTypeParser(20, (value) => Number(value));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATABASE_URL = process.env.DATABASE_URL || '';
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCHEMA_SQL = fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
const MAX_BODY = 7 * 1024 * 1024;
const MAX_IMAGE_CHARS = 5 * 1024 * 1024;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 150000;
const MAX_SAFE_CURSOR = Number.MAX_SAFE_INTEGER;

if (!DATABASE_URL) {
  console.error('');
  console.error('Rise needs DATABASE_URL with your Supabase Postgres connection string.');
  console.error('Copy .env.example to .env and add the connection string from Supabase.');
  console.error('');
  process.exit(1);
}

function sslOption() {
  if (process.env.DATABASE_SSL === 'false' || /sslmode=disable/i.test(DATABASE_URL)) return false;
  if (process.env.DATABASE_CA_CERT) {
    return {
      ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n'),
      rejectUnauthorized: true
    };
  }
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslOption(),
  max: Math.max(Number(process.env.PG_POOL_MAX) || 8, 1),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

pool.on('error', (error) => {
  console.error('Postgres pool error:', error.message);
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const POST_SELECT = `
  SELECT p.id, p.text, p.image, p.created_at,
    u.id AS author_id, u.username AS author_username,
    (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked
  FROM posts p
  JOIN users u ON u.id = p.user_id`;

function sendJson(res, status, data) {
  if (res.headersSent) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, 'That request is too large.'));
        return;
      }
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpError(400, 'Invalid JSON.'));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(new HttpError(400, 'Invalid JSON.'));
      }
    });

    req.on('error', () => reject(new HttpError(400, 'Could not read the request.')));
  });
}

async function getUserByUsername(username) {
  const result = await pool.query(
    'SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
    [username]
  );
  return result.rows[0] || null;
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    createdAt: row.created_at,
    postCount: row.post_count,
    fanCount: row.fan_count,
    followingCount: row.following_count
  };
}

async function loadUserById(id) {
  const result = await pool.query(`
    SELECT u.id, u.username, u.bio, u.created_at,
      (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id) AS post_count,
      (SELECT COUNT(*)::int FROM fans f WHERE f.following_id = u.id) AS fan_count,
      (SELECT COUNT(*)::int FROM fans f WHERE f.follower_id = u.id) AS following_count
    FROM users u
    WHERE u.id = $1`, [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

function mapPost(row) {
  return {
    id: row.id,
    text: row.text,
    image: row.image || null,
    createdAt: row.created_at,
    likeCount: row.like_count,
    liked: Boolean(row.liked),
    author: {
      id: row.author_id,
      username: row.author_username
    }
  };
}

function normalizeCursor(value) {
  const number = Number.parseInt(value, 10);
  return Number.isSafeInteger(number) && number > 0 ? number : MAX_SAFE_CURSOR;
}

async function listPosts(whereSql, whereParams, viewerId, before, limit) {
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 30);
  const params = [viewerId].concat(whereParams);
  const cursorIndex = params.length + 1;
  params.push(normalizeCursor(before));
  const limitIndex = params.length + 1;
  params.push(safeLimit + 1);

  const result = await pool.query(
    POST_SELECT + ' WHERE ' + whereSql + ' AND p.id < $' + cursorIndex + ' ORDER BY p.id DESC LIMIT $' + limitIndex,
    params
  );
  const hasMore = result.rows.length > safeLimit;
  const posts = result.rows.slice(0, safeLimit).map(mapPost);
  return {
    posts,
    hasMore,
    nextCursor: hasMore && posts.length ? posts[posts.length - 1].id : null
  };
}

async function loadPost(postId, viewerId) {
  const result = await pool.query(POST_SELECT + ' WHERE p.id = $2', [viewerId, postId]);
  return result.rows[0] ? mapPost(result.rows[0]) : null;
}

function getToken(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(header);
  return match ? match[1] : null;
}

async function requireUser(req) {
  const token = getToken(req);
  if (!token) throw new HttpError(401, 'Please log in.');
  const result = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [token]
  );
  const session = result.rows[0];
  if (!session || Number(session.expires_at) <= Date.now()) {
    if (session) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    throw new HttpError(401, 'Your session expired. Please log in again.');
  }
  const userResult = await pool.query(
    'SELECT id, username, bio, created_at FROM users WHERE id = $1',
    [session.user_id]
  );
  if (!userResult.rows[0]) throw new HttpError(401, 'Please log in.');
  return userResult.rows[0];
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await pool.query(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [token, userId, now, now + SESSION_MS]
  );
  return token;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const separator = stored.indexOf(':');
  if (separator < 1) return false;
  const salt = stored.slice(0, separator);
  const expected = stored.slice(separator + 1);
  const actual = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const imagePrefixPattern = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64$/i;
const base64Pattern = /^[A-Za-z0-9+/=\r\n]+$/;

function validateImage(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'That photo is not valid.');
  if (value.length > MAX_IMAGE_CHARS) throw new HttpError(413, 'That photo is too large. Try a smaller one.');
  const comma = value.indexOf(',');
  if (comma < 0 || !imagePrefixPattern.test(value.slice(0, comma))) {
    throw new HttpError(400, 'Use a JPEG, PNG, WebP, or GIF photo.');
  }
  if (!base64Pattern.test(value.slice(comma + 1))) throw new HttpError(400, 'That photo is not valid.');
  return value;
}

function likePattern(value) {
  return '%' + value.replace(/[\\%_]/g, (character) => '\\' + character) + '%';
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return null;
  }
}

const rateBuckets = new Map();

function clientAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, name, max, windowMs) {
  const key = clientAddress(req) + ':' + name;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
}

setInterval(() => {
  const now = Date.now();
  for (const entry of rateBuckets) {
    if (entry[1].resetAt <= now) rateBuckets.delete(entry[0]);
  }
  pool.query('DELETE FROM sessions WHERE expires_at <= $1', [now])
    .catch((error) => console.error('Session cleanup failed:', error.message));
}, 60 * 60 * 1000).unref();

async function handleSignup(req, res) {
  rateLimit(req, 'signup', 30, 10 * 60 * 1000);
  const body = await readJson(req);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    throw new HttpError(400, 'Username must be 3-20 letters, numbers, or underscores.');
  }
  if (password.length < 6 || password.length > 128) {
    throw new HttpError(400, 'Password must be 6-128 characters.');
  }
  if (await getUserByUsername(username)) {
    throw new HttpError(409, 'That username is already taken.');
  }

  let userId;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, bio, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, hashPassword(password), '', Date.now()]
    );
    userId = result.rows[0].id;
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'That username is already taken.');
    }
    throw error;
  }

  const token = await createSession(userId);
  sendJson(res, 201, { token, user: await loadUserById(userId) });
}

async function handleLogin(req, res) {
  rateLimit(req, 'login', 40, 10 * 60 * 1000);
  const body = await readJson(req);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) throw new HttpError(400, 'Enter your username and password.');

  const user = await getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Wrong username or password.');
  }

  const token = await createSession(user.id);
  sendJson(res, 200, { token, user: await loadUserById(user.id) });
}

async function handleLogout(req, res) {
  const token = getToken(req);
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  sendJson(res, 200, { ok: true });
}

async function handleUpdateMe(req, res, user) {
  const body = await readJson(req);
  const currentResult = await pool.query('SELECT bio FROM users WHERE id = $1', [user.id]);
  const current = currentResult.rows[0];

  let bio = current.bio;
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') throw new HttpError(400, 'Bio must be text.');
    bio = body.bio.trim();
    if (bio.length > 160) throw new HttpError(400, 'Bio can be up to 160 characters.');
  }

  await pool.query('UPDATE users SET bio = $1 WHERE id = $2', [bio, user.id]);
  sendJson(res, 200, { user: await loadUserById(user.id) });
}

async function handleFeed(req, res, user, url) {
  const result = await listPosts(
    '(p.user_id = $2 OR p.user_id IN (SELECT following_id FROM fans WHERE follower_id = $2))',
    [user.id],
    user.id,
    url.searchParams.get('before'),
    15
  );
  sendJson(res, 200, result);
}

async function handleDiscover(req, res, user, url) {
  const result = await listPosts('1 = 1', [], user.id, url.searchParams.get('before'), 15);
  const peopleResult = await pool.query(`
    SELECT u.id, u.username, u.bio, u.created_at,
      (SELECT COUNT(*)::int FROM fans f WHERE f.following_id = u.id) AS fan_count,
      EXISTS(SELECT 1 FROM fans f WHERE f.follower_id = $1 AND f.following_id = u.id) AS is_fan
    FROM users u
    WHERE u.id <> $2
    ORDER BY u.id DESC
    LIMIT 8`, [user.id, user.id]);
  const people = peopleResult.rows.map((row) => Object.assign(mapUser(row), {
    isFan: Boolean(row.is_fan),
    isMe: false
  }));
  sendJson(res, 200, Object.assign(result, { people }));
}

async function handleUserProfile(req, res, user, username) {
  const target = await getUserByUsername(username);
  if (!target) throw new HttpError(404, 'User not found.');

  const result = await pool.query(`
    SELECT u.id, u.username, u.bio, u.created_at,
      (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id) AS post_count,
      (SELECT COUNT(*)::int FROM fans f WHERE f.following_id = u.id) AS fan_count,
      (SELECT COUNT(*)::int FROM fans f WHERE f.follower_id = u.id) AS following_count,
      EXISTS(SELECT 1 FROM fans f WHERE f.follower_id = $1 AND f.following_id = u.id) AS is_fan
    FROM users u
    WHERE u.id = $2`, [user.id, target.id]);
  const row = result.rows[0];

  const profile = mapUser(row);
  profile.isFan = Boolean(row.is_fan);
  profile.isMe = target.id === user.id;

  const posts = await listPosts('p.user_id = $2', [target.id], user.id, null, 12);
  sendJson(res, 200, {
    user: profile,
    posts: posts.posts,
    hasMore: posts.hasMore,
    nextCursor: posts.nextCursor
  });
}

async function handleUserPosts(req, res, user, username, url) {
  const target = await getUserByUsername(username);
  if (!target) throw new HttpError(404, 'User not found.');
  const result = await listPosts(
    'p.user_id = $2',
    [target.id],
    user.id,
    url.searchParams.get('before'),
    12
  );
  sendJson(res, 200, result);
}

async function handleFanToggle(req, res, user, username) {
  const target = await getUserByUsername(username);
  if (!target) throw new HttpError(404, 'User not found.');
  if (target.id === user.id) throw new HttpError(400, 'You cannot fan yourself.');

  const existing = await pool.query(
    'SELECT 1 AS found FROM fans WHERE follower_id = $1 AND following_id = $2',
    [user.id, target.id]
  );

  let isFan;
  if (existing.rows.length) {
    await pool.query(
      'DELETE FROM fans WHERE follower_id = $1 AND following_id = $2',
      [user.id, target.id]
    );
    isFan = false;
  } else {
    await pool.query(
      'INSERT INTO fans (follower_id, following_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [user.id, target.id, Date.now()]
    );
    isFan = true;
  }

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM fans WHERE following_id = $1',
    [target.id]
  );
  const followingResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM fans WHERE follower_id = $1',
    [user.id]
  );
  sendJson(res, 200, {
    isFan,
    fanCount: countResult.rows[0].count,
    followingCount: followingResult.rows[0].count
  });
}

async function handleFanList(req, res, user, username, kind) {
  const target = await getUserByUsername(username);
  if (!target) throw new HttpError(404, 'User not found.');

  const base = `
    SELECT u.id, u.username, u.bio, u.created_at,
      (SELECT COUNT(*)::int FROM fans f2 WHERE f2.following_id = u.id) AS fan_count,
      EXISTS(SELECT 1 FROM fans f2 WHERE f2.follower_id = $1 AND f2.following_id = u.id) AS is_fan
    FROM fans f
    JOIN users u ON u.id = `;

  const result = kind === 'fans'
    ? await pool.query(base + 'f.follower_id WHERE f.following_id = $2 ORDER BY f.created_at DESC LIMIT 200', [user.id, target.id])
    : await pool.query(base + 'f.following_id WHERE f.follower_id = $2 ORDER BY f.created_at DESC LIMIT 200', [user.id, target.id]);

  sendJson(res, 200, {
    users: result.rows.map((row) => Object.assign(mapUser(row), {
      isFan: Boolean(row.is_fan),
      isMe: row.id === user.id
    }))
  });
}

async function handleSearch(req, res, user, url) {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) {
    sendJson(res, 200, { users: [], posts: [] });
    return;
  }
  if (query.length > 80) throw new HttpError(400, 'Search is too long.');

  const pattern = likePattern(query);
  const usersResult = await pool.query(`
    SELECT u.id, u.username, u.bio, u.created_at,
      (SELECT COUNT(*)::int FROM fans f WHERE f.following_id = u.id) AS fan_count,
      EXISTS(SELECT 1 FROM fans f WHERE f.follower_id = $1 AND f.following_id = u.id) AS is_fan
    FROM users u
    WHERE u.username ILIKE $2 ESCAPE '\\'
    ORDER BY LOWER(u.username) ASC
    LIMIT 20`, [user.id, pattern]);

  const users = usersResult.rows.map((row) => Object.assign(mapUser(row), {
    isFan: Boolean(row.is_fan),
    isMe: row.id === user.id
  }));

  const posts = await listPosts("p.text ILIKE $2 ESCAPE '\\'", [pattern], user.id, null, 30);
  sendJson(res, 200, { users, posts: posts.posts });
}

async function handleCreatePost(req, res, user) {
  rateLimit(req, 'post:' + user.id, 60, 60 * 60 * 1000);
  const body = await readJson(req);
  const text = typeof body.text === 'string' ? body.text.replace(/\r\n/g, '\n').trim() : '';

  if (text.length > 1000) throw new HttpError(400, 'Posts can be up to 1,000 characters.');
  const image = validateImage(body.image);
  if (!text && !image) throw new HttpError(400, 'Write something or add a photo.');

  const result = await pool.query(
    'INSERT INTO posts (user_id, text, image, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
    [user.id, text, image, Date.now()]
  );
  const post = await loadPost(result.rows[0].id, user.id);
  sendJson(res, 201, { post });
}

async function handleDeletePost(req, res, user, postId) {
  const result = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
  const post = result.rows[0];
  if (!post) throw new HttpError(404, 'Post not found.');
  if (post.user_id !== user.id) throw new HttpError(403, 'You can only delete your own posts.');
  await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
  sendJson(res, 200, { ok: true });
}

async function handleLike(req, res, user, postId) {
  const postResult = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
  if (!postResult.rows[0]) throw new HttpError(404, 'Post not found.');

  const existing = await pool.query(
    'SELECT 1 AS found FROM likes WHERE post_id = $1 AND user_id = $2',
    [postId, user.id]
  );

  let liked;
  if (existing.rows.length) {
    await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, user.id]);
    liked = false;
  } else {
    await pool.query(
      'INSERT INTO likes (post_id, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [postId, user.id, Date.now()]
    );
    liked = true;
  }

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
    [postId]
  );
  sendJson(res, 200, { liked, likeCount: countResult.rows[0].count });
}

async function handleRequest(req, res) {
  applySecurityHeaders(res);

  const method = (req.method || 'GET').toUpperCase();
  let url;
  try {
    url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  } catch (error) {
    throw new HttpError(400, 'Bad request.');
  }
  const pathname = url.pathname;

  if ((method === 'GET' || method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(INDEX_HTML),
      'Cache-Control': 'no-cache'
    });
    if (method === 'HEAD') res.end();
    else res.end(INDEX_HTML);
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    try {
      await pool.query('SELECT 1');
      sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error('Health check failed:', error.message);
      sendJson(res, 503, { ok: false });
    }
    return;
  }

  if (pathname === '/api/signup' && method === 'POST') {
    await handleSignup(req, res);
    return;
  }

  if (pathname === '/api/login' && method === 'POST') {
    await handleLogin(req, res);
    return;
  }

  if (pathname === '/api/logout' && method === 'POST') {
    await handleLogout(req, res);
    return;
  }

  if (pathname.indexOf('/api/') === 0) {
    const user = await requireUser(req);

    if (pathname === '/api/me' && method === 'GET') {
      sendJson(res, 200, { user: await loadUserById(user.id) });
      return;
    }
    if (pathname === '/api/me' && method === 'PATCH') {
      await handleUpdateMe(req, res, user);
      return;
    }
    if (pathname === '/api/feed' && method === 'GET') {
      await handleFeed(req, res, user, url);
      return;
    }
    if (pathname === '/api/discover' && method === 'GET') {
      await handleDiscover(req, res, user, url);
      return;
    }
    if (pathname === '/api/posts' && method === 'POST') {
      await handleCreatePost(req, res, user);
      return;
    }
    if (pathname === '/api/search' && method === 'GET') {
      await handleSearch(req, res, user, url);
      return;
    }

    let match = /^\/api\/posts\/(\d+)(\/like)?$/.exec(pathname);
    if (match) {
      const postId = Number(match[1]);
      if (!Number.isSafeInteger(postId) || postId <= 0) throw new HttpError(404, 'Not found.');
      if (match[2] && method === 'POST') {
        await handleLike(req, res, user, postId);
        return;
      }
      if (!match[2] && method === 'DELETE') {
        await handleDeletePost(req, res, user, postId);
        return;
      }
    }

    match = /^\/api\/users\/([^/]+)(\/(posts|fan|fans|following))?$/.exec(pathname);
    if (match) {
      const username = safeDecode(match[1]);
      if (!username) throw new HttpError(404, 'Not found.');
      const section = match[3] || '';
      if (!section && method === 'GET') {
        await handleUserProfile(req, res, user, username);
        return;
      }
      if (section === 'posts' && method === 'GET') {
        await handleUserPosts(req, res, user, username, url);
        return;
      }
      if (section === 'fan' && method === 'POST') {
        await handleFanToggle(req, res, user, username);
        return;
      }
      if (section === 'fans' && method === 'GET') {
        await handleFanList(req, res, user, username, 'fans');
        return;
      }
      if (section === 'following' && method === 'GET') {
        await handleFanList(req, res, user, username, 'following');
        return;
      }
    }

    throw new HttpError(404, 'Not found.');
  }

  throw new HttpError(404, 'Not found.');
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(res, 500, { error: 'Something went wrong.' });
  });
});

server.on('clientError', (error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

function localAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach((name) => {
    (interfaces[name] || []).forEach((info) => {
      if ((info.family === 'IPv4' || info.family === 4) && !info.internal) {
        addresses.push(info.address);
      }
    });
  });
  return addresses;
}

function databaseLabel() {
  try {
    const parsed = new URL(DATABASE_URL);
    return parsed.hostname + parsed.pathname;
  } catch (error) {
    return 'Postgres';
  }
}

async function initDatabase() {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await pool.query(SCHEMA_SQL);
      await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [Date.now()]);
      return;
    } catch (error) {
      console.error('Database init failed (' + attempt + '/5): ' + error.message);
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function start() {
  await initDatabase();
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Rise is running');
    console.log('  Local:    http://localhost:' + PORT);
    if (!process.env.RENDER) {
      localAddresses().forEach((address) => {
        console.log('  Phone:    http://' + address + ':' + PORT);
      });
    }
    console.log('  Database: ' + databaseLabel());
    console.log('');
  });
}

function shutdown() {
  server.close(() => {
    pool.end()
      .then(() => process.exit(0))
      .catch(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  console.error('Rise could not start:', error.message);
  process.exit(1);
});
