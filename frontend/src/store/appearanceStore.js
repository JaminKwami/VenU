import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/*
 * Appearance preference: { theme, accent, motion }.
 * Persisted under the same key the pre-hydration script in index.html reads,
 * so the attributes are on <html> before first paint (no FOUC).
 */

// Monochrome tones — onyx (default) plus graphite / slate / taupe / ash.
export const ACCENTS = [
  { id: 'cobalt', color: '#1c1c1e' },     // Onyx (default)
  { id: 'coral', color: '#3f3f46' },      // Graphite
  { id: 'evergreen', color: '#475569' },  // Slate
  { id: 'violet', color: '#57534e' },     // Taupe
  { id: 'amber', color: '#525252' },      // Ash
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
