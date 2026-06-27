import { create } from 'zustand';

// Global state for the slide-in navigation sidebar (web + mobile).
export const useSidebarStore = create((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  openSidebar: () => set({ open: true }),
  close: () => set({ open: false }),
}));
