import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/*
 * Appearance preference: { theme, accent, motion }.
 * Persisted under the same key the pre-hydration script in index.html reads,
 * so the attributes are on <html> before first paint (no FOUC).
 */

export const ACCENTS = [
  { id: 'cobalt', color: '#2a4ddb' },
  { id: 'coral', color: '#ff5a36' },
  { id: 'evergreen', color: '#1f6c52' },
  { id: 'violet', color: '#6b3df0' },
  { id: 'amber', color: '#d2861a' },
];

function applyToHtml({ theme, accent, motion }) {
  const r = document.documentElement;
  r.setAttribute('data-theme', theme);
  if (accent === 'cobalt') r.removeAttribute('data-accent');
  else r.setAttribute('data-accent', accent);
  r.setAttribute('data-motion', motion);
}

export const useAppearanceStore = create(
  persist(
    (set, get) => ({
      theme: 'light',
      accent: 'cobalt',
      motion: 'cinematic',
      setAppearance: (key, value) => {
        set({ [key]: value });
        const { theme, accent, motion } = get();
        applyToHtml({ theme, accent, motion });
      },
    }),
    {
      name: 'venu_appearance_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, accent: s.accent, motion: s.motion }),
      // zustand persist wraps state as {state, version}; the inline <head>
      // script understands both shapes.
      onRehydrateStorage: () => (state) => { if (state) applyToHtml(state); },
    },
  ),
);
