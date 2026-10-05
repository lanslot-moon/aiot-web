import { createContext } from 'react';
import { notesType } from 'src/types/apps/notes';

export interface NotesContextType {
  notes: notesType[];
  loading: boolean;
  error: Error | null;
  selectedNoteId: number;
  selectNote: (id: number) => void;
  addNote: (newNote: notesType) => Promise<void>;
  updateNote: (id: number, title: string, color: string) => Promise<void>;
  deleteNote: (id: number) => Promise<void>;
}

export const initialContext: NotesContextType = {
  notes: [],
  loading: true,
  error: null,
  selectedNoteId: 1,
  selectNote: () => {},
  addNote: async () => {},
  updateNote: async () => {},
  deleteNote: async () => {},
};

export const NotesContext = createContext<NotesContextType>(initialContext);
