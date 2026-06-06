import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import { supabase, type Profile, type Department } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  departments: Department[];
  loading: boolean;
  userDepartments: Department[];
  isAdmin: () => boolean;
  isDeptHead: () => boolean;
  isInDept: (code: string) => boolean;
  isFinance: () => boolean;
  isMS: () => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  suppressAuthChanges: () => () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const suppressCountRef = useRef(0);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments((data as Department[]) || []);
  };

  const suppressAuthChanges = () => {
    suppressCountRef.current++;
    return () => {
      suppressCountRef.current = Math.max(0, suppressCountRef.current - 1);
    };
  };

  useEffect(() => {
    let isMounted = true;

    const finishInitialLoad = () => {
      if (isMounted) {
        setLoading(false);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          Promise.all([fetchProfile(session.user.id), fetchDepartments()]).finally(
            finishInitialLoad
          );
        } else {
          setProfile(null);
          fetchDepartments().finally(finishInitialLoad);
        }
      })
      .catch(() => {
        finishInitialLoad();
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (suppressCountRef.current > 0) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        void fetchDepartments();
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        return;
      }

      if (!session?.user) {
        return;
      }

      setSession(session);
      setUser(session.user);

      if (event === 'USER_UPDATED') {
        void fetchProfile(session.user.id);
        return;
      }

      void Promise.all([fetchProfile(session.user.id), fetchDepartments()]);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const userDepartments = departments.filter(d =>
    profile?.department_ids?.includes(d.id)
  );

  const isAdmin = () => profile?.role === 'super_admin';
  const isDeptHead = () => profile?.role === 'department_head' || profile?.role === 'super_admin';
  const isInDept = (code: string) => {
    if (profile?.role === 'super_admin') return true;
    return userDepartments.some(d => d.code === code);
  };
  const isFinance = () => isInDept('FI');
  const isMS = () => isInDept('MS');

  return (
    <AuthContext.Provider value={{
      user, session, profile, departments, loading,
      userDepartments, isAdmin, isDeptHead, isInDept,
      isFinance, isMS, refreshProfile, signOut, suppressAuthChanges,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
