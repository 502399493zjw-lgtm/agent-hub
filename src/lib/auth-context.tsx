'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { users, type User } from '@/data/mock';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'agent-hub-auth-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    // Mock login: match by name (case-insensitive) or id; default to xiaoyue
    await new Promise(r => setTimeout(r, 500)); // simulate network
    const mockUser = users.find(u =>
      u.name.toLowerCase() === email.toLowerCase() ||
      u.id.toLowerCase() === email.toLowerCase()
    ) || users.find(u => u.id === 'xiaoyue') || users[0];
    setUser(mockUser);
    return true;
  }, []);

  const register = useCallback(async (username: string, _email: string, _password: string): Promise<boolean> => {
    // Mock register: create a fake user based on input
    await new Promise(r => setTimeout(r, 500));
    const newUser: User = {
      id: `u-${Date.now()}`,
      name: username,
      avatar: '👤',
      bio: '新用户，还没有写简介~',
      joinedAt: new Date().toISOString().slice(0, 10),
      publishedAssets: [],
      favoriteAssets: [],
      followers: 0,
      following: 0,
    };
    setUser(newUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const updateProfile = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
