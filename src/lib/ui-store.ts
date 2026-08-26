"use client";
import { create } from "zustand";

/**
 * Shared UI state for cross-component coordination.
 *
 * Used to:
 *  - Open/close the mobile sidebar drawer from the topbar (Menu button) and from
 *    inside the sidebar (link navigation).
 *  - Open/close the global command palette from the topbar (Search button) and
 *    from the keyboard shortcut (Cmd/Ctrl+K) handled inside CommandPalette.
 *
 * Kept intentionally tiny — these are transient UI flags, not domain state.
 */
interface UIState {
  /** Mobile sidebar drawer open state (Sheet). Desktop/tablet sidebar is always inline. */
  sidebarMobileOpen: boolean;
  setSidebarMobileOpen: (open: boolean) => void;

  /** Global command palette open state. */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarMobileOpen: false,
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
