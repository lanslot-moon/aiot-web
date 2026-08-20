

import { Bloghandlers } from 'src/api/blog/blogdata';
import { NotesHandlers } from 'src/api/notes/notedata';
import { OpenPlatformHandlers } from 'src/api/open-platform/open-platform-data';
import { TicketHandlers } from 'src/api/ticket/ticket-data';


export const mockHandlers = [
  ...Bloghandlers,
  ...NotesHandlers,
  ...TicketHandlers,
  ...OpenPlatformHandlers,
];
