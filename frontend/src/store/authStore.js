import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'venu-auth',       // localStorage key
      partialize: (s) => ({    // only persist tokens — not derived user state
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
