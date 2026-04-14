export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category_id: number;
  category_name: string;
  description: string;
  cover_url: string;
  file_url?: string;
  total_copies: number;
  available_copies: number;
}

export interface Category {
  id: number;
  name: string;
}
