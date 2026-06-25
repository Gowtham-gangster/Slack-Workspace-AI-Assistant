'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { setAuthToken, getAuthToken, apiFetch, setRefreshToken, getRefreshToken } from '../lib/api';

interface User {
  id: number;
  username: string;
  fullName?: string;
}

export interface SlackUser {
  realName: string;
  name: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  slackUsers: Record<string, SlackUser>;
  login: (token: string, user: User, redirectPath?: string | null, refreshToken?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slackUsers, setSlackUsers] = useState<Record<string, SlackUser>>({});
  const router = useRouter();
  const pathname = usePathname();

  // Load Slack users once logged in
  useEffect(() => {
    async function loadSlackUsers() {
      if (user && token) {
        try {
          const data = await apiFetch('/api/channels/users');
          setSlackUsers(data || {});
        } catch (error) {
          console.warn('Failed to load slack users mapping:', error);
        }
      } else {
        setSlackUsers({});
      }
    }
    loadSlackUsers();
  }, [user, token]);

  // On mount — restore session from stored token
  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          setToken(storedToken);
          const data = await apiFetch('/api/auth/me');
          setUser(data.user);
        } catch (error: any) {
          // If auto-refresh in apiFetch succeeded, /me will have worked.
          // If we land here it means refresh also failed — clear everything.
          console.error('Failed to load user with stored token:', error);
          setAuthToken(null);
          setRefreshToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  // Route protection
  useEffect(() => {
    if (!loading) {
      const isPublicPath =
        pathname === '/login' ||
        pathname === '/' ||
        pathname === '/privacy' ||
        pathname === '/terms';
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = (
    newToken: string,
    newUser: User,
    redirectPath: string | null = '/dashboard',
    refreshToken?: string
  ) => {
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    if (redirectPath) {
      router.push(redirectPath);
    }
  };

  const logout = async () => {
    // Revoke refresh token on the server (best effort)
    const storedRefreshToken = getRefreshToken();
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
      });
    } catch {
      // Ignore errors — local cleanup still happens
    }

    setAuthToken(null);
    setRefreshToken(null);
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, slackUsers, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
