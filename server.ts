import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_BORROW_LIMIT = 3;

// --- Database Setup ---
let _pool: any = null;
const pool = {
  query: (...args: any[]) => {
    if (!_pool) {
      const dbUrl = process.env.DATABASE_URL || process.env.database_url;
      if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');
      _pool = new Pool({ 
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
    }
    // @ts-ignore
    return _pool.query(...args);
  },
  connect: () => {
    if (!_pool) {
      const dbUrl = process.env.DATABASE_URL || process.env.database_url;
      if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');
      _pool = new Pool({ 
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      });
    }
    // @ts-ignore
    return _pool.connect();
  }
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.jwt_secret;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'manager', 'user')) NOT NULL DEFAULT 'user',
        name TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn TEXT UNIQUE,
        category_id INTEGER REFERENCES categories(id),
        description TEXT,
        cover_url TEXT,
        file_url TEXT,
        total_copies INTEGER DEFAULT 1,
        available_copies INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS borrow_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        book_id INTEGER NOT NULL REFERENCES books(id),
        borrow_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        return_date TIMESTAMP,
        status TEXT CHECK(status IN ('borrowed', 'returned')) DEFAULT 'borrowed'
      );

      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        book_id INTEGER NOT NULL REFERENCES books(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS files (
        filename VARCHAR(255) PRIMARY KEY,
        mime_type VARCHAR(100),
        data BYTEA,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add avatar_url column if it doesn't exist (if the table was created before)
    try {
      await client.query('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    } catch (e: any) {
      // Ignore "column already exists" error (42701 in Postgres)
      if (e.code !== '42701') {
        console.warn('Could not add avatar_url column:', e.message);
      }
    }

    try {
      const salt = bcrypt.genSaltSync(10);
      const adminHash = bcrypt.hashSync('12345678', salt);
      await client.query(`UPDATE users SET email = $1, password_hash = $2 WHERE email = 'admin@library.com' OR role = 'admin'`, ['admin@digilib.com', adminHash]);
    } catch (e: any) {
      console.warn('Could not update admin user:', e.message);
    }

    const { rows } = await client.query('SELECT count(*) as count FROM users');
    if (parseInt(rows[0].count) === 0) {
      console.log('Seeding initial data...');
      const salt = bcrypt.genSaltSync(10);
      const adminHash = bcrypt.hashSync('12345678', salt);
      const userHash = bcrypt.hashSync('user123', salt);

      await client.query(
        'INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, $3, $4)',
        ['admin@digilib.com', adminHash, 'admin', 'System Administrator']
      );
      await client.query(
        'INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, $3, $4)',
        ['user@library.com', userHash, 'user', 'John Doe']
      );

      const categories = ['Technology', 'Science', 'Literature', 'Business', 'Education'];
      for (const cat of categories) {
        await client.query('INSERT INTO categories (name) VALUES ($1)', [cat]);
      }
      console.log('Initial data seeded.');
    }
  } finally {
    client.release();
  }
}

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- Express App Setup ---
const app = express();
app.use(express.json());

// Middleware for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

const saveFileToDB = async (file: Express.Multer.File): Promise<string> => {
  const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  await pool.query(
    'INSERT INTO files (filename, mime_type, data) VALUES ($1, $2, $3)',
    [filename, file.mimetype, file.buffer]
  );
  return filename;
};

app.get('/uploads/:filename', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT mime_type, data FROM files WHERE filename = $1', [req.params.filename]);
    if (result.rows.length > 0) {
      res.setHeader('Content-Type', result.rows[0].mime_type);
      return res.send(result.rows[0].data);
    }
  } catch (e) {
    console.error('Error fetching file from DB:', e);
  }
  next(); // fallback to express.static if not found (for old local files)
});
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Auth Middleware ---
interface AuthRequest extends Request {
  user?: any;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, getJwtSecret(), (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') return res.sendStatus(403);
  next();
};

// --- API Routes ---

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name, avatar_url: user.avatar_url }, getJwtSecret(), { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, avatar_url: user.avatar_url } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    await pool.query('INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, $3, $4)', [email, hash, 'user', name]);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err: any) {
    if (err.code === '23505') { // unique violation
      res.status(400).json({ message: 'Email already exists' });
    } else {
      res.status(500).json({ message: err.message });
    }
  }
});

// Books (Public Read)
app.get('/api/books', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = `
      SELECT b.*, c.name as category_name 
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (b.title ILIKE $${paramIndex} OR b.author ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }
    if (category) {
      query += ` AND c.name = $${paramIndex}`;
      params.push(category);
    }

    // ORDER BY id inside the query so results are predictable
    query += ` ORDER BY b.id DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, c.name as category_name 
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = $1
    `, [req.params.id]);
    
    if (rows.length === 0) return res.status(404).json({ message: 'Book not found' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categories');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Books (Admin Write)
app.post('/api/books', authenticateToken, requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'bookFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, author, isbn, category_id, description, total_copies } = req.body;
    let cover_url = req.body.cover_url;
    let file_url = null;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.coverImage?.[0]) {
      const filename = await saveFileToDB(files.coverImage[0]);
      cover_url = `/uploads/${filename}`;
    }
    if (files?.bookFile?.[0]) {
      const filename = await saveFileToDB(files.bookFile[0]);
      file_url = `/uploads/${filename}`;
    }

    const { rows } = await pool.query(`
      INSERT INTO books (title, author, isbn, category_id, description, cover_url, file_url, total_copies, available_copies)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [title, author, isbn || null, category_id || null, description, cover_url || null, file_url || null, total_copies || 1, total_copies || 1]);
    
    res.status(201).json({ id: rows[0].id });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/books/:id', authenticateToken, requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'bookFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, author, category_id, description, total_copies } = req.body;
    const id = req.params.id;
    
    let cover_url = req.body.cover_url;
    let file_url = req.body.file_url;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.coverImage?.[0]) {
      const filename = await saveFileToDB(files.coverImage[0]);
      cover_url = `/uploads/${filename}`;
    }
    if (files?.bookFile?.[0]) {
      const filename = await saveFileToDB(files.bookFile[0]);
      file_url = `/uploads/${filename}`;
    }

    const { rows } = await pool.query('SELECT total_copies, available_copies FROM books WHERE id = $1', [id]);
    const currentBook = rows[0];
    if (!currentBook) return res.status(404).json({ message: 'Book not found' });

    const diff = Number(total_copies) - currentBook.total_copies;
    const newAvailable = Math.max(0, currentBook.available_copies + diff);

    await pool.query(`
      UPDATE books 
      SET title = $1, author = $2, category_id = $3, description = $4, cover_url = $5, file_url = $6, total_copies = $7, available_copies = $8
      WHERE id = $9
    `, [title, author, category_id || null, description, cover_url || null, file_url || null, total_copies, newAvailable, id]);
    
    res.json({ message: 'Book updated' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/books/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE book_id = $1', [req.params.id]);
    await pool.query('DELETE FROM borrow_records WHERE book_id = $1', [req.params.id]);
    await pool.query('DELETE FROM books WHERE id = $1', [req.params.id]);
    res.json({ message: 'Book deleted' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// File Upload
app.post('/api/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const filename = await saveFileToDB(req.file);
  const fileUrl = `/uploads/${filename}`;
  res.json({ url: fileUrl });
});

// Stats (Admin)
app.get('/api/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await pool.query('SELECT count(*) as count FROM users');
    const books = await pool.query('SELECT count(*) as count FROM books');
    const borrows = await pool.query('SELECT count(*) as count FROM borrow_records');
    
    res.json({
      users: parseInt(users.rows[0].count),
      books: parseInt(books.rows[0].count),
      borrows: parseInt(borrows.rows[0].count)
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// User Profile & History
app.get('/api/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const userQuery = await pool.query('SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1', [userId]);
    
    const historyQuery = await pool.query(`
      SELECT br.*, b.title, b.author, b.cover_url 
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      WHERE br.user_id = $1
      ORDER BY br.borrow_date DESC
    `, [userId]);

    const wishlistQuery = await pool.query(`
      SELECT b.*, c.name as category_name
      FROM wishlist w
      JOIN books b ON w.book_id = b.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `, [userId]);

    res.json({ user: userQuery.rows[0], history: historyQuery.rows, wishlist: wishlistQuery.rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/profile/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const filename = await saveFileToDB(req.file);
    const avatarUrl = `/uploads/${filename}`;
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);
    res.json({ message: 'Avatar updated', avatarUrl });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: All Rentals
app.get('/api/admin/rentals', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT br.*, b.title, u.email as user_email, u.name as user_name
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      JOIN users u ON br.user_id = u.id
      ORDER BY br.borrow_date DESC
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Wishlist
app.post('/api/wishlist/:bookId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.bookId;
    await pool.query('INSERT INTO wishlist (user_id, book_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, bookId]);
    res.json({ message: 'Added to wishlist' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/wishlist/:bookId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.bookId;
    await pool.query('DELETE FROM wishlist WHERE user_id = $1 AND book_id = $2', [userId, bookId]);
    res.json({ message: 'Removed from wishlist' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/wishlist/ids', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query('SELECT book_id FROM wishlist WHERE user_id = $1', [userId]);
    res.json(rows.map(row => row.book_id));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Borrow Book
app.post('/api/books/:id/borrow', authenticateToken, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const bookId = req.params.id;

    const bookRes = await client.query('SELECT available_copies FROM books WHERE id = $1 FOR UPDATE', [bookId]);
    if (bookRes.rows.length === 0 || bookRes.rows[0].available_copies < 1) {
      throw new Error('Book not available');
    }

    const borrowCountRes = await client.query("SELECT count(*) as count FROM borrow_records WHERE user_id = $1 AND status = 'borrowed'", [userId]);
    if (parseInt(borrowCountRes.rows[0].count) >= MAX_BORROW_LIMIT) {
      throw new Error(`Borrow limit reached. You are allowed to borrow a maximum of ${MAX_BORROW_LIMIT} books at a time.`);
    }

    const existingRes = await client.query("SELECT id FROM borrow_records WHERE user_id = $1 AND book_id = $2 AND status = 'borrowed'", [userId, bookId]);
    if (existingRes.rows.length > 0) {
      throw new Error('You have already borrowed this book');
    }

    await client.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [bookId]);
    await client.query('INSERT INTO borrow_records (user_id, book_id) VALUES ($1, $2)', [userId, bookId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Book borrowed successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

// Return Book
app.post('/api/books/:id/return', authenticateToken, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const bookId = req.params.id;

    const recordRes = await client.query("SELECT id FROM borrow_records WHERE user_id = $1 AND book_id = $2 AND status = 'borrowed'", [userId, bookId]);
    if (recordRes.rows.length === 0) {
      throw new Error('No active borrow record found');
    }

    await client.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = $1', [bookId]);
    await client.query("UPDATE borrow_records SET status = 'returned', return_date = CURRENT_TIMESTAMP WHERE id = $1", [recordRes.rows[0].id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Book returned successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

// --- Server Start ---
async function startServer() {
  try {
    if (process.env.DATABASE_URL || process.env.database_url) {
      await initDB();
    } else {
      console.warn('DATABASE_URL environment variable is missing. Database initialization skipped.');
    }
  } catch (err: any) {
    console.error('Failed to initialize database:', err.message);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
