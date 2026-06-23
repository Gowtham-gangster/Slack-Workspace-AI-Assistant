'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { setAuthToken, getAuthToken, apiFetch } from '../lib/api';

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
  login: (token: string, user: User, redirectPath?: string | null) => void;
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

  useEffect(() => {
    async function loadUser() {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          setToken(storedToken);
          const data = await apiFetch('/api/auth/me');
          setUser(data.user);
        } catch (error) {
          console.error('Failed to load user with stored token:', error);
          // Don't call logout here to avoid infinite redirect loops on mount,
          // just clear tokens silently.
          setAuthToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!loading) {
      const isPublicPath = pathname === '/login' || pathname === '/' || pathname === '/privacy' || pathname === '/terms';
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = (newToken: string, newUser: User, redirectPath: string | null = '/dashboard') => {
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    if (redirectPath) {
      router.push(redirectPath);
    }
  };

  const logout = () => {
    setAuthToken(null);
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
