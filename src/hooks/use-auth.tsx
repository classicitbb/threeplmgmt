import {
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type RoleCode =
  | "admin"
  | "warehouse_manager"
  | "inventory_clerk"
  | "warehouse_operator"
  | "dispatch_driver";

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  roles: RoleCode[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (allowed: RoleCode[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfileBundle(userId: string) {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("user_roles")
      .select("role_id, roles!inner(code)")
      .eq("user_id", userId),
  ]);

  const roles = (roleRows ?? [])
    .flatMap((row) => {
      const nested = row.roles as { code: RoleCode } | { code: RoleCode }[] | null;

      if (Array.isArray(nested)) {
        return nested.map((entry) => entry.code);
      }

      return nested ? [nested.code] : [];
    })
    .filter((value, index, values) => values.indexOf(value) === index);

  return {
    profile: profile ?? null,
    roles,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [roles, setRoles] = useState<RoleCode[]>([]);

  const refreshProfile = useCallback(async () => {
    const currentUser = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : user;

    if (!currentUser) {
      setProfile(null);
      setRoles([]);
      return;
    }

    const bundle = await fetchProfileBundle(currentUser.id);
    setProfile(bundle.profile);
    setRoles(bundle.roles);
  }, [user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        const bundle = await fetchProfileBundle(data.session.user.id);
        if (!mounted) {
          return;
        }
        setProfile(bundle.profile);
        setRoles(bundle.roles);
      }

      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      fetchProfileBundle(nextSession.user.id)
        .then((bundle) => {
          if (!mounted) {
            return;
          }
          setProfile(bundle.profile);
          setRoles(bundle.roles);
        })
        .finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user,
      profile,
      roles,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
      refreshProfile,
      hasRole: (allowed) => allowed.some((role) => roles.includes(role)),
    }),
    [loading, profile, refreshProfile, roles, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
