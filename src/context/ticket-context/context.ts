import { createContext } from 'react';
import { TicketType } from '../../types/apps/ticket';

export interface TicketContextType {
  tickets: TicketType[];
  deleteTicket: (id: number) => void;
  setTicketSearch: (searchTerm: string) => void;
  searchTickets: (searchTerm: string) => void;
  ticketSearch: string;
  filter: string;
  error: unknown;
  loading: boolean;
  setFilter: (filter: string) => void;
  addTicket: (ticket: TicketType) => void;
}

export const TicketContext = createContext<TicketContextType>({} as TicketContextType);
