import pg from 'pg';
const users = Number(process.env.SEED_USERS || 50000);
const posts = Number(process.env.SEED_POSTS || 500000);
const likes = Number(process.env.SEED_LIKES || 2000000);
if (![users, posts, likes].every(Number.isSafeInteger) || users < 1 || posts < 1 || likes < 0 || likes > users * posts) throw new Error('Invalid dataset sizes');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('TRUNCATE likes, posts, users RESTART IDENTITY CASCADE');
  await client.query("INSERT INTO users SELECT n, 'user_' || n FROM generate_series(1, $1::int) n", [users]);
  await client.query("INSERT INTO posts (user_id, body, created_at) SELECT ((n-1) % $2::int)+1, 'Seeded post ' || n, TIMESTAMPTZ '2025-01-01' + n * INTERVAL '1 second' FROM generate_series(1, $1::int) n", [posts, users]);
  await client.query('INSERT INTO likes SELECT ((n-1) % $2::int)+1, (((n-1) / $2::int) % $3::int)+1 FROM generate_series(1, $1::int) n', [likes, posts, users]);
  await client.query('UPDATE posts SET likes = counts.total FROM (SELECT post_id, count(*)::int total FROM likes GROUP BY post_id) counts WHERE posts.id = counts.post_id');
  await client.query('COMMIT');
  await client.query('ANALYZE');
  console.log(JSON.stringify({ users, posts, likes }));
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
