import { createContext, Dispatch, SetStateAction } from 'react';
import { BlogPostType, BlogType } from 'src/types/apps/blog';

export interface BlogContextProps {
  posts: BlogPostType[];
  sortBy: string;
  selectedPost: BlogPostType | null;
  isLoading: boolean;
  setPosts: Dispatch<SetStateAction<BlogPostType[]>>;
  setSortBy: Dispatch<SetStateAction<string>>;
  setSelectedPost: Dispatch<SetStateAction<BlogPostType | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  addComment: (postId: NonNullable<BlogPostType['id']>, newComment: BlogType) => void;

  error: unknown;
}

export const BlogContext = createContext<BlogContextProps>({
  posts: [],
  sortBy: 'newest',
  selectedPost: null,
  isLoading: true,
  setPosts: () => { },
  setSortBy: () => { },
  setSelectedPost: () => { },
  setLoading: () => { },
  addComment: () => { },
  error: null,
});
