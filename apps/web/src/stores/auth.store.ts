import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  user: any | null;
  organisation: any | null;
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; user: any; organisation: any }) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      organisation: null,
      isAuthenticated: false,
      setAuth: (data) =>
        set({
          accessToken: data.accessToken,
          user: data.user,
          organisation: data.organisation,
          isAuthenticated: true,
        }),
      setToken: (token) => set({ accessToken: token }),
      logout: () =>
        set({
          accessToken: null,
          user: null,
          organisation: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'marinestream-auth' },
  ),
);
