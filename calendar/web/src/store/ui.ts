import { addMonths, addWeeks, subMonths, subWeeks } from "date-fns";
import { create } from "zustand";

/** The two calendar surfaces: a month grid and a linear agenda list. */
export type CalendarView = "month" | "agenda";

interface UiState {
  /** Which calendar surface is showing. */
  view: CalendarView;
  /** The focused month/day — all reads derive their range from this. */
  cursor: Date;
  /** The event open in the editor, or null when creating / closed. */
  selectedEventId: string | null;
  /** Whether the event modal is open. */
  modalOpen: boolean;
  /** ISO date (yyyy-MM-dd) to prefill a new event with, when creating. */
  draftDate: string | null;

  setView: (view: CalendarView) => void;
  setCursor: (cursor: Date) => void;
  /** Step forward a month (month view) or a week (agenda view). */
  nextPeriod: () => void;
  /** Step back a month (month view) or a week (agenda view). */
  prevPeriod: () => void;
  /** Jump the cursor back to today. */
  today: () => void;

  /** Open the modal to create a new event, optionally prefilled to a date. */
  openNewEvent: (date?: string) => void;
  /** Open the modal to edit an existing event. */
  openEvent: (id: string) => void;
  /** Close the event modal. */
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "month",
  cursor: new Date(),
  selectedEventId: null,
  modalOpen: false,
  draftDate: null,

  setView: (view) => set({ view }),
  setCursor: (cursor) => set({ cursor }),
  nextPeriod: () =>
    set((s) => ({
      cursor: s.view === "month" ? addMonths(s.cursor, 1) : addWeeks(s.cursor, 1),
    })),
  prevPeriod: () =>
    set((s) => ({
      cursor: s.view === "month" ? subMonths(s.cursor, 1) : subWeeks(s.cursor, 1),
    })),
  today: () => set({ cursor: new Date() }),

  openNewEvent: (date) => set({ modalOpen: true, selectedEventId: null, draftDate: date ?? null }),
  openEvent: (id) => set({ modalOpen: true, selectedEventId: id, draftDate: null }),
  closeModal: () => set({ modalOpen: false, selectedEventId: null, draftDate: null }),
}));
