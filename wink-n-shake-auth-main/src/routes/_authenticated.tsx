import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setState(s ? "ok" : "no");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(data.session ? "ok" : "no");
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (state === "no") {
      window.location.replace("/login");
    }
  }, [state]);

  if (state !== "ok") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  return <Outlet />;
}
