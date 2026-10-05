import React, { ReactNode, useEffect, useState } from 'react';
import { getFetcher } from 'src/api/global-fetcher';
import { BlogPostType, BlogType } from 'src/types/apps/blog';
import useSWR from 'swr';
import { BlogContext, BlogContextProps } from './context';

// BlogProvider component
export const BlogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<BlogPostType[]>([]);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedPost, setSelectedPost] = useState<BlogPostType | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Fetch Post data from the API
  const {
    data: postsData,
    isLoading: isPostsLoading,
    error: postsError,
  } = useSWR('/api/data/blog/BlogPosts', getFetcher);

  useEffect(() => {
    if (postsData) {
      setPosts(postsData.data);
      setLoading(isPostsLoading);
    } else if (postsError) {
      setError(postsError);
      setLoading(isPostsLoading);
    } else {
      setLoading(isPostsLoading);
    }
  }, [postsData, postsError, isPostsLoading]);

  // Adds a new comment to a specific post by updating the state.
  const addComment = (postId: NonNullable<BlogPostType['id']>, newComment: BlogType) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, comments: [newComment, ...(post.comments || [])] } : post,
      ),
    );
  };

  const value: BlogContextProps = {
    posts,
    sortBy,
    selectedPost,
    isLoading,
    setPosts,
    setSortBy,
    setSelectedPost,
    setLoading,
    addComment,
    error,
  };

  return <BlogContext.Provider value={value}>{children}</BlogContext.Provider>;
};
