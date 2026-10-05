import { useEffect, useState } from 'react';
import { NotesContext, initialContext } from './context';

import React from 'react';
import { deleteFetcher, getFetcher, postFetcher, putFetcher } from 'src/api/global-fetcher';
import { notesType } from 'src/types/apps/notes';
import useSWR from 'swr';

// Provider component
export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<notesType[]>(initialContext.notes);
  const [loading, setLoading] = useState<boolean>(initialContext.loading);
  const [error, setError] = useState<Error | null>(initialContext.error);
  const [selectedNoteId, setSelectedNoteId] = useState<number>(initialContext.selectedNoteId);

  // Fetch notes from the server
  const {
    data: notesData,
    isLoading: isNotesLoading,
    error: notesError,
    mutate,
  } = useSWR('/api/data/notes/NotesData', getFetcher);
  useEffect(() => {
    if (notesData) {
      setNotes(notesData.data);
      setLoading(false);
    } else if (notesError) {
      setError(notesError);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [notesData, notesError, isNotesLoading]);

  // Select a note by its ID
  const selectNote = (id: number) => {
    setSelectedNoteId(id);
  };

  // Add a new note
  const addNote = async (newNote: notesType) => {
    try {
      await mutate(postFetcher('/api/notes/add', newNote));
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  // Update a note by its ID
  const updateNote = async (id: number, title: string, color: string) => {
    try {
      await mutate(putFetcher('/api/notes/update', { id, title, color }));
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  // Delete a note by its ID
  const deleteNote = async (id: number) => {
    try {
      const response = await mutate(deleteFetcher('/api/notes/delete', { id }));
      console.log(response.data);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        loading,
        error,
        selectedNoteId,
        selectNote,
        addNote,
        updateNote,
        deleteNote,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};
