import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Book, Category } from './types';
import { Search, Filter, BookOpen, LogOut, User as UserIcon, Settings, Plus, Trash2, Edit, Heart } from 'lucide-react';
import { useWishlist } from './contexts/WishlistContext';
import { motion } from 'motion/react';

// --- Components ---

function Homepage({ onNavigate }: { onNavigate: (page: 'login' | 'library') => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-8"
      >
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
          <BookOpen className="h-12 w-12 text-indigo-600" />
        </div>
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
          Your Cloud Library, <span className="text-indigo-600">Reimagined.</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Access thousands of digital books, manage inventory, and experience the power of a cloud-native library system built for the modern web.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => onNavigate('login')}
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
          >
            Get Started
          </button>
          <button
            onClick={() => onNavigate('library')}
            className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Browse Books
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full max-w-5xl">
        {[
          { icon: Search, title: "Smart Search", desc: "Find any book instantly with our powerful search engine." },
          { icon: Settings, title: "Admin Tools", desc: "Comprehensive inventory management for librarians." },
          { icon: UserIcon, title: "User Profiles", desc: "Track your reading history and manage loans." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 + 0.2 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left"
          >
            <feature.icon className="h-8 w-8 text-indigo-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-500">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Navbar({ currentView, onViewChange }: { currentView: string; onViewChange: (view: any) => void }) {
  const { user, logout, isAdmin } = useAuth();

  const isActive = (view: string) => currentView === view ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center cursor-pointer" onClick={() => onViewChange('home')}>
            <BookOpen className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">AzureLib</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => onViewChange('home')} 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('home')}`}
            >
              Home
            </button>
            <button 
              onClick={() => onViewChange('library')} 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('library')}`}
            >
              Library
            </button>
            {user ? (
              <>
                <button 
                  onClick={() => onViewChange('profile')} 
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ml-2 ${isActive('profile')}`}
                >
                  <UserIcon className="h-4 w-4 mr-1" />
                  {user.name}
                </button>
                {isAdmin && (
                  <span className="px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-100 rounded-full ml-2">
                    Admin
                  </span>
                )}
                <button
                  onClick={() => { logout(); onViewChange('home'); }}
                  className="ml-4 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-4 ml-4">
                <button 
                  onClick={() => onViewChange('login')} 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('login')}`}
                >
                  Login
                </button>
                <button onClick={() => onViewChange('register')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// --- Modals ---

function BookFormModal({ isOpen, onClose, onSave, editingBook }: { isOpen: boolean; onClose: () => void; onSave: () => void; editingBook: Book | null }) {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    category_id: '',
    description: '',
    total_copies: 5,
    cover_url: 'https://picsum.photos/seed/newbook/200/300',
    file_url: ''
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      fetch('/api/categories').then(res => res.json()).then(setCategories);
      if (editingBook) {
        setFormData({
          title: editingBook.title,
          author: editingBook.author,
          isbn: editingBook.isbn || '',
          category_id: editingBook.category_id.toString(),
          description: editingBook.description,
          total_copies: editingBook.total_copies,
          cover_url: editingBook.cover_url,
          file_url: editingBook.file_url || ''
        });
      } else {
        setFormData({
          title: '',
          author: '',
          isbn: '',
          category_id: '',
          description: '',
          total_copies: 5,
          cover_url: 'https://picsum.photos/seed/newbook/200/300',
          file_url: ''
        });
      }
      setCoverImage(null);
      setBookFile(null);
    }
  }, [isOpen, editingBook]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    else if (formData.title.length < 2) newErrors.title = 'Title must be at least 2 characters';

    if (!formData.author.trim()) newErrors.author = 'Author is required';
    else if (formData.author.length < 2) newErrors.author = 'Author must be at least 2 characters';

    if (!formData.isbn.trim()) newErrors.isbn = 'ISBN is required';
    else if (!/^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/.test(formData.isbn)) newErrors.isbn = 'Invalid ISBN format (10 or 13 digits)';

    if (!formData.category_id) newErrors.category_id = 'Please select a category';

    if (!formData.description.trim()) newErrors.description = 'Description is required';
    else if (formData.description.length < 10) newErrors.description = 'Description must be at least 10 characters';

    if (formData.total_copies < 1) newErrors.total_copies = 'Total copies must be at least 1';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('author', formData.author);
    data.append('isbn', formData.isbn);
    data.append('category_id', formData.category_id);
    data.append('description', formData.description);
    data.append('total_copies', formData.total_copies.toString());
    data.append('cover_url', formData.cover_url);
    data.append('file_url', formData.file_url);
    
    if (coverImage) {
      data.append('coverImage', coverImage);
    }

    if (bookFile) {
      data.append('bookFile', bookFile);
    }

    const url = editingBook ? `/api/books/${editingBook.id}` : '/api/books';
    const method = editingBook ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 
        Authorization: `Bearer ${token}`
      },
      body: data
    });
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">{editingBook ? 'Edit Book' : 'Add New Book'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <LogOut className="h-5 w-5 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input 
                className={`w-full px-3 py-2 border rounded-lg ${errors.title ? 'border-red-500' : 'border-gray-300'}`} 
                value={formData.title} 
                onChange={e => {
                  setFormData({...formData, title: e.target.value});
                  if (errors.title) setErrors({...errors, title: ''});
                }} 
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input 
                className={`w-full px-3 py-2 border rounded-lg ${errors.author ? 'border-red-500' : 'border-gray-300'}`} 
                value={formData.author} 
                onChange={e => {
                  setFormData({...formData, author: e.target.value});
                  if (errors.author) setErrors({...errors, author: ''});
                }} 
              />
              {errors.author && <p className="text-xs text-red-500 mt-1">{errors.author}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
              <input 
                className={`w-full px-3 py-2 border rounded-lg ${errors.isbn ? 'border-red-500' : 'border-gray-300'}`} 
                value={formData.isbn} 
                onChange={e => {
                  setFormData({...formData, isbn: e.target.value});
                  if (errors.isbn) setErrors({...errors, isbn: ''});
                }} 
              />
              {errors.isbn && <p className="text-xs text-red-500 mt-1">{errors.isbn}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select 
                className={`w-full px-3 py-2 border rounded-lg bg-white ${errors.category_id ? 'border-red-500' : 'border-gray-300'}`} 
                value={formData.category_id} 
                onChange={e => {
                  setFormData({...formData, category_id: e.target.value});
                  if (errors.category_id) setErrors({...errors, category_id: ''});
                }}
              >
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-xs text-red-500 mt-1">{errors.category_id}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              className={`w-full px-3 py-2 border rounded-lg ${errors.description ? 'border-red-500' : 'border-gray-300'}`} 
              rows={3} 
              value={formData.description} 
              onChange={e => {
                setFormData({...formData, description: e.target.value});
                if (errors.description) setErrors({...errors, description: ''});
              }} 
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Copies</label>
            <input 
              type="number" 
              min="1" 
              className={`w-full px-3 py-2 border rounded-lg ${errors.total_copies ? 'border-red-500' : 'border-gray-300'}`} 
              value={isNaN(formData.total_copies) ? '' : formData.total_copies} 
              onChange={e => {
                const val = parseInt(e.target.value);
                setFormData({...formData, total_copies: isNaN(val) ? 0 : val});
                if (errors.total_copies) setErrors({...errors, total_copies: ''});
              }} 
            />
            {errors.total_copies && <p className="text-xs text-red-500 mt-1">{errors.total_copies}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
            <input 
              type="file" 
              accept="image/*"
              className="w-full px-3 py-2 border rounded-lg"
              onChange={e => {
                if (e.target.files?.[0]) {
                  setCoverImage(e.target.files[0]);
                }
              }} 
            />
            {!editingBook && <p className="text-xs text-gray-500 mt-1">Leave empty to use random cover</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book PDF</label>
            <input 
              type="file" 
              accept=".pdf"
              className="w-full px-3 py-2 border rounded-lg"
              onChange={e => {
                if (e.target.files?.[0]) {
                  setBookFile(e.target.files[0]);
                }
              }} 
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              {editingBook ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- User Components ---

function Register({ onLogin }: { onLogin: () => void }) {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Registration failed');
      onLogin(); // Switch to login view
    } catch (err) {
      setError('Registration failed. Email may already be in use.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500">Join AzureLib today</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input required className="w-full px-4 py-2 border rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="w-full px-4 py-2 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required className="w-full px-4 py-2 border rounded-lg" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Register</button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={onLogin} className="text-sm text-indigo-600 hover:underline">Already have an account? Login</button>
        </div>
      </div>
    </div>
  );
}

function UserProfile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<{ user: any, history: any[] } | null>(null);

  const fetchProfile = () => {
    fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(setProfile);
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const handleReturn = async (bookId: number) => {
    await fetch(`/api/books/${bookId}/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchProfile();
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-6">
        <div className="h-20 w-20 bg-indigo-100 rounded-full flex items-center justify-center">
          <UserIcon className="h-10 w-10 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.user.name}</h1>
          <p className="text-gray-500">{profile.user.email}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-md capitalize">
            {profile.user.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Rental History</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {profile.history.map((record: any) => (
              <div key={record.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img src={record.cover_url} alt={record.title} className="h-16 w-12 object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                  <div>
                    <h3 className="font-medium text-gray-900">{record.title}</h3>
                    <p className="text-sm text-gray-500">Borrowed: {new Date(record.borrow_date).toLocaleDateString()}</p>
                    {record.return_date && (
                      <p className="text-sm text-gray-500">Returned: {new Date(record.return_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <div>
                  {record.status === 'borrowed' ? (
                    <button 
                      onClick={() => handleReturn(record.book_id)}
                      className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                    >
                      Return
                    </button>
                  ) : (
                    <span className="px-3 py-1 text-sm font-medium text-gray-500 bg-gray-100 rounded-full">
                      Returned
                    </span>
                  )}
                </div>
              </div>
            ))}
            {profile.history.length === 0 && (
              <div className="p-8 text-center text-gray-500">No rental history found.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">My Wishlist</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {profile.wishlist.map((book: any) => (
              <div key={book.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img src={book.cover_url} alt={book.title} className="h-16 w-12 object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                  <div>
                    <h3 className="font-medium text-gray-900">{book.title}</h3>
                    <p className="text-sm text-gray-500">{book.author}</p>
                  </div>
                </div>
              </div>
            ))}
            {profile.wishlist.length === 0 && (
              <div className="p-8 text-center text-gray-500">Your wishlist is empty.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookDetailsModal({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const { token, user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [message, setMessage] = useState('');

  if (!book) return null;

  const handleBorrow = async () => {
    if (!user) return alert('Please login to borrow books');
    
    const res = await fetch(`/api/books/${book.id}/borrow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
    if (res.ok) {
      setMessage('Book borrowed successfully!');
      setTimeout(onClose, 1500);
    } else {
      setMessage(data.message);
    }
  };

  const isWishlisted = isInWishlist(book.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col md:flex-row"
      >
        <div className="md:w-1/3 bg-gray-100 relative">
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          {user && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(book.id);
              }}
              className={`absolute top-4 right-4 p-2 rounded-full shadow-md transition-colors ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white text-gray-400 hover:text-red-500'}`}
            >
              <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
        <div className="p-6 md:w-2/3 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{book.title}</h2>
              <p className="text-gray-500">{book.author}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <LogOut className="h-6 w-6 rotate-45" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2 mb-6">
            <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-md">
              {book.category_name}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-md ${book.available_copies > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {book.available_copies > 0 ? `${book.available_copies} Available` : 'Out of Stock'}
            </span>
          </div>

          <p className="text-gray-600 mb-6 flex-grow">{book.description}</p>

          {message && (
            <div className={`mb-4 p-3 text-sm rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 flex space-x-3">
            <button 
              onClick={handleBorrow}
              disabled={book.available_copies === 0}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {book.available_copies > 0 ? 'Borrow Book' : 'Unavailable'}
            </button>
            {book.file_url ? (
              <a 
                href={book.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                Preview PDF
              </a>
            ) : (
              <button 
                disabled
                className="flex-1 border border-gray-300 text-gray-400 py-2 rounded-lg font-medium cursor-not-allowed"
              >
                No PDF Available
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BookCard({ book, onOpen }: { book: Book; onOpen: (book: Book) => void }) {
  const { user } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(book.id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onOpen(book)}
    >
      <div className="aspect-[2/3] relative bg-gray-100">
        <img 
          src={book.cover_url} 
          alt={book.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-white/90 backdrop-blur-sm rounded-md shadow-sm">
            {book.category_name}
          </span>
          {user && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(book.id);
              }}
              className={`p-1.5 rounded-full shadow-sm transition-colors self-end ${isWishlisted ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-500'}`}
            >
              <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1" title={book.title}>{book.title}</h3>
        <p className="text-sm text-gray-500 mb-2">{book.author}</p>
        <div className="flex items-center justify-between mt-4">
          <span className={`text-xs font-medium ${book.available_copies > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {book.available_copies > 0 ? 'Available' : 'Out of Stock'}
          </span>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ users: 0, books: 0, borrows: 0 });
  const [books, setBooks] = useState<Book[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'rentals'>('inventory');

  const fetchBooks = () => {
    fetch('/api/books')
      .then(res => res.json())
      .then(data => setBooks(data));
  };

  useEffect(() => {
    fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStats(data));
      
    fetchBooks();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'rentals') {
      fetch('/api/admin/rentals', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setRentals);
    }
  }, [token, activeTab]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/books/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setBooks(books.filter(b => b.id !== id));
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingBook(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <BookFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={fetchBooks}
        editingBook={editingBook}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.users}</p>
            </div>
            <UserIcon className="h-8 w-8 text-indigo-100 text-indigo-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Books</p>
              <p className="text-2xl font-bold text-gray-900">{stats.books}</p>
            </div>
            <BookOpen className="h-8 w-8 text-indigo-100 text-indigo-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Loans</p>
              <p className="text-2xl font-bold text-gray-900">{stats.borrows}</p>
            </div>
            <Settings className="h-8 w-8 text-indigo-100 text-indigo-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inventory'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('rentals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rentals'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Rentals
            </button>
          </nav>
        </div>

        {activeTab === 'inventory' ? (
          <>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Book Inventory</h2>
              <button 
                onClick={handleAdd}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Book
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Author</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {books.map(book => (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{book.title}</td>
                      <td className="px-6 py-4 text-gray-500">{book.author}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                          {book.category_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{book.available_copies}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => handleEdit(book)}
                          className="text-gray-400 hover:text-indigo-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(book.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Book</th>
                  <th className="px-6 py-4">Borrowed Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rentals.map(rental => (
                  <tr key={rental.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{rental.user_name}</div>
                      <div className="text-gray-500 text-xs">{rental.user_email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{rental.title}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(rental.borrow_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${rental.status === 'borrowed' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {rental.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    fetch('/api/categories').then(res => res.json()).then(setCategories);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (selectedCategory) params.append('category', selectedCategory);
    
    fetch(`/api/books?${params}`).then(res => res.json()).then(setBooks);
  }, [search, selectedCategory]);

  return (
    <div className="space-y-6">
      <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or author..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {books.map(book => (
          <div key={book.id}>
            <BookCard book={book} onOpen={setSelectedBook} />
          </div>
        ))}
      </div>
      
      {books.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No books found matching your criteria.
        </div>
      )}
    </div>
  );
}

function Login({ onRegister }: { onRegister: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@library.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) throw new Error('Invalid credentials');
      
      const data = await res.json();
      login(data.token, data.user);
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <BookOpen className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500">Sign in to access your library</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Sign In
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <button onClick={onRegister} className="text-sm text-indigo-600 hover:underline">Don't have an account? Register</button>
        </div>


      </div>
    </div>
  );
}

export default function App() {
  const { user, isAdmin } = useAuth();
  const [view, setView] = useState<'home' | 'login' | 'register' | 'library' | 'admin' | 'profile'>('home');

  // Redirect to library after login if on login/register page
  useEffect(() => {
    if (user && (view === 'login' || view === 'register')) {
      setView('library');
    }
  }, [user, view]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar currentView={view} onViewChange={setView} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'home' && <Homepage onNavigate={(page) => setView(page)} />}
        
        {view === 'login' && !user && <Login onRegister={() => setView('register')} />}
        
        {view === 'register' && !user && <Register onLogin={() => setView('login')} />}
        
        {view === 'profile' && user && <UserProfile />}

        {view === 'library' && (
          <>
            {isAdmin && (
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => setView('admin')}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm"
                >
                  Go to Admin Dashboard
                </button>
              </div>
            )}
            <Library />
          </>
        )}

        {view === 'admin' && user && isAdmin && (
          <>
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setView('library')}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm"
              >
                Back to Library
              </button>
            </div>
            <AdminDashboard />
          </>
        )}

        {/* Fallback for unauthorized admin access */}
        {view === 'admin' && (!user || !isAdmin) && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-gray-600 mt-2">You do not have permission to view this page.</p>
            <button 
              onClick={() => setView('home')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              Go Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
