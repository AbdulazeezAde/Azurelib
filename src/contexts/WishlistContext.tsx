import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  wishlistIds: number[];
  toggleWishlist: (bookId: number) => Promise<void>;
  isInWishlist: (bookId: number) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);

  const fetchWishlistIds = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/wishlist/ids', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWishlistIds(data);
      }
    } catch (err) {
      console.error('Failed to fetch wishlist ids', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWishlistIds();
    } else {
      setWishlistIds([]);
    }
  }, [user, token]);

  const toggleWishlist = async (bookId: number) => {
    if (!token) return;
    const isAdded = wishlistIds.includes(bookId);
    const method = isAdded ? 'DELETE' : 'POST';
    
    try {
      const res = await fetch(`/api/wishlist/${bookId}`, {
        method,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setWishlistIds(prev => 
          isAdded ? prev.filter(id => id !== bookId) : [...prev, bookId]
        );
      }
    } catch (err) {
      console.error('Failed to toggle wishlist', err);
    }
  };

  const isInWishlist = (bookId: number) => wishlistIds.includes(bookId);

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
