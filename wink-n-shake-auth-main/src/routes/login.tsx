import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Mail, Lock as LockIcon, Smartphone, ShieldX, ShieldCheck, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell, Field } from "./signup";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · Sentinel" }] }),
});

type Stage = "creds" | "waiting" | "approved" | "denied" | "expired";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("creds");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // countdown
  useEffect(() => {
    if (stage !== "waiting") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // expire client-side
  useEffect(() => {
    if (stage === "waiting" && secondsLeft === 0) {
      void markExpired();
    }
  }, [secondsLeft, stage]);

  async function markExpired() {
    if (!challengeId) return;
    await supabase.from("auth_challenges").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", challengeId);
    setStage("expired");
    await supabase.auth.signOut();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !signInData.user) {
      setLoading(false);
      toast.error(error?.message ?? "Invalid credentials");
      return;
    }

    // check paired devices
    const { data: devices } = await supabase
      .from("paired_devices")
      .select("id, paired_at")
      .eq("user_id", signInData.user.id)
      .not("paired_at", "is", null);

    if (!devices || devices.length === 0) {
      setLoading(false);
      toast.message("No paired phone yet — let's set one up.");
      navigate({ to: "/pair" });
      return;
    }

    // create challenge
    const { data: ch, error: chErr } = await supabase
      .from("auth_challenges")
      .insert({
        user_id: signInData.user.id,
        device_id: devices[0].id,
        status: "pending",
        user_agent: navigator.userAgent,
        location_hint: typeof window !== "undefined" ? window.location.host : null,
      })
      .select()
      .single();

    setLoading(false);

    if (chErr || !ch) {
      toast.error(chErr?.message ?? "Could not create login request");
      return;
    }

    setChallengeId(ch.id);
    setStage("waiting");
    setSecondsLeft(120);

    // subscribe
    const channel = supabase
      .channel(`challenge:${ch.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auth_challenges", filter: `id=eq.${ch.id}` },
        (payload) => {
          const next = payload.new as { status: Stage };
          if (next.status === "approved") {
            setStage("approved");
            setTimeout(() => navigate({ to: "/dashboard" }), 800);
          } else if (next.status === "denied") {
            setStage("denied");
            void supabase.auth.signOut();
          } else if (next.status === "expired") {
            setStage("expired");
            void supabase.auth.signOut();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }

  useEffect(() => {
    return () => { if (channelRef.current) void supabase.removeChannel(channelRef.current); };
  }, []);

  if (stage !== "creds") {
    return (
      <AuthShell title={stageTitle(stage)} subtitle={stageSubtitle(stage)}>
        <WaitingPanel stage={stage} secondsLeft={secondsLeft} challengeId={challengeId} onCancel={() => { void supabase.auth.signOut(); setStage("creds"); }} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in" subtitle="We'll push an approval to your trusted phone.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="your email@.com" />
        <Field icon={LockIcon} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        <button type="submit" disabled={loading} className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here? <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}

function stageTitle(s: Stage) {
  if (s === "waiting") return "Approve on your phone";
  if (s === "approved") return "Approved";
  if (s === "denied") return "Denied";
  return "Request expired";
}
function stageSubtitle(s: Stage) {
  if (s === "waiting") return "We pushed a sign-in request over the secure channel.";
  if (s === "approved") return "Welcome back. Redirecting…";
  if (s === "denied") return "The sign-in attempt was rejected from your device.";
  return "The request timed out. Try again.";
}

function WaitingPanel({ stage, secondsLeft, challengeId, onCancel }: { stage: Stage; secondsLeft: number; challengeId: string | null; onCancel: () => void }) {
  if (stage === "approved") {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-success/15 ring-1 ring-success/40">
          <ShieldCheck className="h-8 w-8 text-success" />
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-success">verified</p>
      </div>
    );
  }
  if (stage === "denied" || stage === "expired") {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-destructive/15 ring-1 ring-destructive/40">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <button onClick={onCancel} className="mt-6 rounded-lg border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2">Try again</button>
      </div>
    );
  }
  // waiting
  return (
    <div>
      <div className="flex flex-col items-center py-6 text-center">
        <div className="relative grid h-20 w-20 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40 pulse-ring">
          <Smartphone className="h-9 w-9 text-primary" />
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.25em] text-primary">awaiting biometric approval</p>
        <p className="mt-2 text-3xl font-display font-semibold tabular-nums">{Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:{(secondsLeft % 60).toString().padStart(2, "0")}</p>
      </div>

      <div className="mt-2 rounded-lg border border-border bg-background/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <div className="flex items-center gap-1.5"><Radio className="h-3 w-3 text-primary" /> channel · open</div>
        {challengeId && <div className="mt-1">challenge.id <span className="text-foreground">{challengeId.slice(0, 8)}…</span></div>}
      </div>

      <button onClick={onCancel} className="mt-4 w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}
