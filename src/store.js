import pg from 'pg';
export function createStore(source = 'postgres') {
  if (source === 'memory') {
    const posts = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, user_id: i + 1, username: `user_${i + 1}`, body: `Demo post ${i + 1}`, likes: 0, created_at: new Date(1700000000000 + i * 1000).toISOString() })).reverse();
    const likes = new Set();
    return {
      feed: async () => posts.slice(0, 20).map(p => ({ ...p })),
      post: async id => posts.find(p => p.id === id),
      create: async (userId, body) => { const p = { id: posts.length + 1, user_id: userId, username: `user_${userId}`, body, likes: 0, created_at: new Date().toISOString() }; posts.unshift(p); return p; },
      like: async (id, userId) => { const p = posts.find(p => p.id === id); if (!p) return undefined; const key = `${id}:${userId}`; if (!likes.has(key)) { likes.add(key); p.likes++; } return { ...p }; },
      health: async () => true,
      close: async () => {}
    };
  }
  if (source !== 'postgres') throw new Error('DATA_SOURCE must be postgres or memory');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 10), connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  const fields = 'p.id, p.user_id, u.username, p.body, p.likes, p.created_at';
  return {
    feed: async () => (await pool.query(`SELECT ${fields} FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC, p.id DESC LIMIT 20`)).rows,
    post: async id => (await pool.query(`SELECT ${fields} FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, [id])).rows[0],
    create: async (userId, body) => (await pool.query('INSERT INTO posts (user_id, body) VALUES ($1, $2) RETURNING *', [userId, body])).rows[0],
    like: async (id, userId) => {
      // Atomic and idempotent: only newly inserted likes increment the counter.
      const result = await pool.query(`WITH inserted AS (
        INSERT INTO likes (post_id, user_id) SELECT id, $2 FROM posts WHERE id = $1
        ON CONFLICT DO NOTHING RETURNING post_id
      ) UPDATE posts SET likes = likes + 1 WHERE id IN (SELECT post_id FROM inserted) RETURNING *`, [id, userId]);
      return result.rows[0] || (await pool.query('SELECT * FROM posts WHERE id = $1', [id])).rows[0];
    },
    health: async () => { await pool.query('SELECT 1'); return true; },
    close: () => pool.end()
  };
}
