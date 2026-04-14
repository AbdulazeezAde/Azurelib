import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const DB_PATH = path.join(process.cwd(), 'library.db');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MAX_BORROW_LIMIT = 3;

// --- Database Setup ---
const db = new Database(DB_PATH);

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'manager', 'user')) NOT NULL DEFAULT 'user',
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    category_id INTEGER,
    description TEXT,
    cover_url TEXT,
    file_url TEXT,
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS borrow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    status TEXT CHECK(status IN ('borrowed', 'returned')) DEFAULT 'borrowed',
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- Mock Data Seeding ---
const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  console.log('Seeding initial data...');
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const userHash = bcrypt.hashSync('user123', salt);

  const insertUser = db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)');
  insertUser.run('admin@library.com', adminHash, 'admin', 'System Administrator');
  insertUser.run('user@library.com', userHash, 'user', 'John Doe');

  const categories = ['Technology', 'Science', 'Literature', 'Business', 'Education'];
  const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
  categories.forEach(cat => insertCategory.run(cat));

  console.log('Initial data seeded.');
}

// --- Express App Setup ---
const app = express();
app.use(express.json());

// Middleware for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use('/uploads', express.static(UPLOADS_DIR));

// --- Auth Middleware ---
interface AuthRequest extends Request {
  user?: any;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
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
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  try {
    const result = db.prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)').run(email, hash, 'user', name);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Email already exists' });
  }
});

// Books (Public Read)
app.get('/api/books', (req, res) => {
  const { search, category } = req.query;
  let query = `
    SELECT b.*, c.name as category_name 
    FROM books b 
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (b.title LIKE ? OR b.author LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    query += ` AND c.name = ?`;
    params.push(category);
  }

  const books = db.prepare(query).all(...params);
  res.json(books);
});

app.get('/api/books/:id', (req, res) => {
  const book = db.prepare(`
    SELECT b.*, c.name as category_name 
    FROM books b 
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.id = ?
  `).get(req.params.id);
  
  if (!book) return res.status(404).json({ message: 'Book not found' });
  res.json(book);
});

app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

// Books (Admin Write)
app.post('/api/books', authenticateToken, requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'bookFile', maxCount: 1 }
]), (req, res) => {
  const { title, author, isbn, category_id, description, total_copies } = req.body;
  let cover_url = req.body.cover_url;
  let file_url = null;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  if (files?.coverImage?.[0]) {
    cover_url = `/uploads/${files.coverImage[0].filename}`;
  }

  if (files?.bookFile?.[0]) {
    file_url = `/uploads/${files.bookFile[0].filename}`;
  }

  try {
    const result = db.prepare(`
      INSERT INTO books (title, author, isbn, category_id, description, cover_url, file_url, total_copies, available_copies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, author, isbn, category_id, description, cover_url, file_url, total_copies, total_copies);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/books/:id', authenticateToken, requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'bookFile', maxCount: 1 }
]), (req, res) => {
  const { title, author, category_id, description, total_copies } = req.body;
  const id = req.params.id;
  
  let cover_url = req.body.cover_url;
  let file_url = req.body.file_url;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  if (files?.coverImage?.[0]) {
    cover_url = `/uploads/${files.coverImage[0].filename}`;
  }

  if (files?.bookFile?.[0]) {
    file_url = `/uploads/${files.bookFile[0].filename}`;
  }

  try {
    // Get current book to calculate available_copies
    const currentBook = db.prepare('SELECT total_copies, available_copies FROM books WHERE id = ?').get(id) as any;
    if (!currentBook) return res.status(404).json({ message: 'Book not found' });

    const diff = Number(total_copies) - currentBook.total_copies;
    const newAvailable = Math.max(0, currentBook.available_copies + diff);

    db.prepare(`
      UPDATE books 
      SET title = ?, author = ?, category_id = ?, description = ?, cover_url = ?, file_url = ?, total_copies = ?, available_copies = ?
      WHERE id = ?
    `).run(title, author, category_id, description, cover_url, file_url, total_copies, newAvailable, id);
    
    res.json({ message: 'Book updated' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/books/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Book deleted' });
});

// File Upload (Simulating Blob Storage)
app.post('/api/upload', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // In a real Azure app, this would upload to Blob Storage and return the blob URL
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Stats (Admin)
app.get('/api/stats', authenticateToken, requireAdmin, (req, res) => {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as any;
  const bookCount = db.prepare('SELECT count(*) as count FROM books').get() as any;
  const borrowCount = db.prepare('SELECT count(*) as count FROM borrow_records').get() as any;
  
  res.json({
    users: userCount.count,
    books: bookCount.count,
    borrows: borrowCount.count
  });
});

// User Profile & History
app.get('/api/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId);
  
  const history = db.prepare(`
    SELECT br.*, b.title, b.author, b.cover_url 
    FROM borrow_records br
    JOIN books b ON br.book_id = b.id
    WHERE br.user_id = ?
    ORDER BY br.borrow_date DESC
  `).all(userId);

  const wishlist = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM wishlist w
    JOIN books b ON w.book_id = b.id
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(userId);

  res.json({ user, history, wishlist });
});

// Admin: All Rentals
app.get('/api/admin/rentals', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const rentals = db.prepare(`
    SELECT br.*, b.title, u.email as user_email, u.name as user_name
    FROM borrow_records br
    JOIN books b ON br.book_id = b.id
    JOIN users u ON br.user_id = u.id
    ORDER BY br.borrow_date DESC
  `).all();
  res.json(rentals);
});

// Wishlist
app.post('/api/wishlist/:bookId', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const bookId = req.params.bookId;

  try {
    db.prepare('INSERT OR IGNORE INTO wishlist (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
    res.json({ message: 'Added to wishlist' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/wishlist/:bookId', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const bookId = req.params.bookId;

  try {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND book_id = ?').run(userId, bookId);
    res.json({ message: 'Removed from wishlist' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/wishlist/ids', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const ids = db.prepare('SELECT book_id FROM wishlist WHERE user_id = ?').all(userId).map((row: any) => row.book_id);
  res.json(ids);
});

// Borrow Book
app.post('/api/books/:id/borrow', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const bookId = req.params.id;

  const borrowTransaction = db.transaction(() => {
    const book = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(bookId) as any;
    if (!book || book.available_copies < 1) {
      throw new Error('Book not available');
    }

    const borrowCount = db.prepare("SELECT count(*) as count FROM borrow_records WHERE user_id = ? AND status = 'borrowed'").get(userId) as any;
    if (borrowCount.count >= MAX_BORROW_LIMIT) {
      throw new Error(`Borrow limit reached. You are allowed to borrow a maximum of ${MAX_BORROW_LIMIT} books at a time.`);
    }

    const existing = db.prepare("SELECT id FROM borrow_records WHERE user_id = ? AND book_id = ? AND status = 'borrowed'").get(userId, bookId);
    if (existing) {
      throw new Error('You have already borrowed this book');
    }

    db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);
    db.prepare('INSERT INTO borrow_records (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
  });

  try {
    borrowTransaction();
    res.json({ message: 'Book borrowed successfully' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Return Book
app.post('/api/books/:id/return', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const bookId = req.params.id;

  const returnTransaction = db.transaction(() => {
    const record = db.prepare("SELECT id FROM borrow_records WHERE user_id = ? AND book_id = ? AND status = 'borrowed'").get(userId, bookId) as any;
    if (!record) {
      throw new Error('No active borrow record found');
    }

    db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(bookId);
    db.prepare("UPDATE borrow_records SET status = 'returned', return_date = CURRENT_TIMESTAMP WHERE id = ?").run(record.id);
  });

  try {
    returnTransaction();
    res.json({ message: 'Book returned successfully' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Serve Uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// --- Server Start ---
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
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
