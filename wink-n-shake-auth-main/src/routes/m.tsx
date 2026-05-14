import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { biometricVerify } from "@/lib/webauthn";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Fingerprint, Loader2, Lock, LogOut, Mail, Radio, ShieldCheck, ShieldX, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

const search = z.object({ pair: z.string().optional() });

export const Route = createFileRoute("/m")({
  validateSearch: (s) => search.parse(s),
  component: MobileApprover,
  head: () => ({ meta: [
    { title: "Approver · Sentinel" },
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" },
  ] }),
});

type Challenge = {
  id: string; user_id: string; status: string; user_agent: string | null;
  location_hint: string | null; created_at: string; expires_at: string;
};

function MobileApprover() {
  const { pair } = Route.useSearch();
  const [authed, setAuthed] = useState<null | { id: string; email: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setAuthed(s ? { id: s.user.id, email: s.user.email ?? "" } : null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(data.session ? { id: data.session.user.id, email: data.session.user.email ?? "" } : null);
      setLoading(false);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (loading) return <Centered><Loader2 className="h-5 w-5 animate-spin text-primary" /></Centered>;

  if (!authed) return <SignInForm pairCode={pair} />;

  return <AuthedApprover userId={authed.id} email={authed.email} pairCode={pair} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center justify-center px-6">{children}</div>;
}

function SignInForm({ pairCode }: { pairCode?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("Account created. Check your email to confirm, then sign in.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-[100dvh] px-6 py-10">
      <Logo />
      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">/ approver setup</p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">
          {mode === "signin" ? "Sign in to bind this phone" : "Create an account on this phone"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pairCode
            ? "Use the same account you signed up with on the web."
            : "Open the pairing link from your computer to bind this device."}
        </p>
      </div>

      <div className="mt-6 inline-flex rounded-lg border border-border p-1 text-xs">
        <button type="button" onClick={() => setMode("signin")}
          className={`px-3 py-1.5 rounded-md ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign in</button>
        <button type="button" onClick={() => setMode("signup")}
          className={`px-3 py-1.5 rounded-md ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign up</button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <MFLabel icon={Mail} label="Email">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
            className="w-full bg-transparent py-3 text-base outline-none" />
        </MFLabel>
        <MFLabel icon={Lock} label="Password">
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className="w-full bg-transparent py-3 text-base outline-none" />
        </MFLabel>
        <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-medium text-primary-foreground transition disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === "signin" ? "Sign in" : "Sign up"} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </div>
  );
}

function MFLabel({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {children}
      </div>
    </label>
  );
}

function AuthedApprover({ userId, email, pairCode }: { userId: string; email: string; pairCode?: string }) {
  const [pairing, setPairing] = useState(false);
  const [pairedNow, setPairedNow] = useState(false);
  const [pending, setPending] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const claimedCode = useRef<string | null>(null);

  // Claim pairing code (once)
  useEffect(() => {
    if (!pairCode || claimedCode.current === pairCode) return;
    const code = pairCode;
    claimedCode.current = code;
    void claim();
    async function claim() {
      setPairing(true);
      const { data, error } = await supabase.rpc("claim_pairing_code", {
        _code: code,
        _device_name: detectDeviceName(),
      });
      setPairing(false);
      if (error) {
        const msg = error.message || "";
        if (msg.includes("PAIR_CODE_INVALID")) toast.error("Pairing code not found. Generate a new one on your computer.");
        else if (msg.includes("PAIR_CODE_ALREADY_USED")) toast.error("This pairing code was already used.");
        else if (msg.includes("PAIR_CODE_WRONG_ACCOUNT")) toast.error(`This code belongs to a different account. Sign in on this phone with the SAME account you used on the web.`);
        else toast.error(msg);
        return;
      }
      if (!data) {
        toast.error("Pairing failed. Try generating a new code.");
        return;
      }
      setPairedNow(true);
      toast.success("Phone paired — you can now approve sign-ins.");
      window.history.replaceState({}, "", "/m");

      window.history.replaceState({}, "", "/m");
    }
  }, [pairCode, userId]);

  // Subscribe to incoming challenges
  useEffect(() => {
    void loadPending();
    const ch = supabase
      .channel("approver:" + userId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auth_challenges", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Challenge;
          if (next.status === "pending") {
            setPending(next);
            try { navigator.vibrate?.([60, 30, 60]); } catch {}
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auth_challenges", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Challenge;
          setPending((cur) => (cur && cur.id === next.id && next.status !== "pending" ? null : cur));
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId]);

  async function loadPending() {
    const { data } = await supabase
      .from("auth_challenges")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data[0]) setPending(data[0] as Challenge);
  }

  async function approve() {
    if (!pending) return;
    setBusy(true);
    try {
      const { method } = await biometricVerify(email);
      const { error } = await supabase
        .from("auth_challenges")
        .update({ status: "approved", responded_at: new Date().toISOString(), biometric_method: method })
        .eq("id", pending.id);
      if (error) throw error;
      toast.success("Approved");
      setPending(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not verify biometric");
    } finally {
      setBusy(false);
    }
  }

  async function deny() {
    if (!pending) return;
    setBusy(true);
    const { error } = await supabase
      .from("auth_challenges")
      .update({ status: "denied", responded_at: new Date().toISOString() })
      .eq("id", pending.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Denied");
    setPending(null);
  }

  return (
    <div className="min-h-[100dvh] px-5 pt-6 pb-10">
      <div className="flex items-center justify-between">
        <Logo />
        <button onClick={() => supabase.auth.signOut()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <LogOut className="h-3 w-3" /> sign out
        </button>
      </div>

      {pairing && <div className="mt-6 rounded-xl border border-border bg-surface/60 p-4 text-sm"><Loader2 className="mr-2 inline h-4 w-4 animate-spin text-primary" />Binding this phone…</div>}

      {pairedNow && (
        <div className="mt-6 rounded-2xl border border-success/40 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-success" />
            <p className="text-sm">This phone is now your trusted device.</p>
          </div>
        </div>
      )}

      {/* Pending challenge */}
      {pending ? (
        <ChallengeCard ch={pending} onApprove={approve} onDeny={deny} busy={busy} />
      ) : (
        <IdleState email={email} />
      )}

      <InstallTip />
    </div>
  );
}

function ChallengeCard({ ch, onApprove, onDeny, busy }: { ch: Challenge; onApprove: () => void; onDeny: () => void; busy: boolean }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((new Date(ch.expires_at).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mt-8">
      <div className="glass relative overflow-hidden rounded-3xl p-6 glow-primary">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <Radio className="h-3 w-3" /> incoming request
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{secs}s</span>
        </div>

        <h2 className="mt-6 font-display text-2xl font-semibold leading-tight">Approve this sign-in?</h2>
        <p className="mt-1 text-sm text-muted-foreground">A device tried to sign in to your account.</p>

        <dl className="mt-5 space-y-2 rounded-xl border border-border bg-background/40 p-4 font-mono text-[11px]">
          <Row k="origin" v={ch.location_hint ?? "—"} />
          <Row k="device" v={truncate(ch.user_agent ?? "—", 56)} />
          <Row k="time" v={new Date(ch.created_at).toLocaleTimeString()} />
        </dl>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button onClick={onDeny} disabled={busy}
            className="grid h-16 w-16 place-items-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive transition active:scale-95 disabled:opacity-60">
            <X className="h-6 w-6" />
          </button>

          <button onClick={onApprove} disabled={busy}
            className="group flex h-20 flex-1 items-center justify-center gap-3 rounded-2xl bg-primary text-primary-foreground transition active:scale-[0.98] disabled:opacity-60 glow-primary">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Fingerprint className="h-7 w-7" />}
            <span className="font-display text-base font-semibold">{busy ? "verifying…" : "Approve with biometric"}</span>
          </button>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          requires Face ID · Touch ID · or fingerprint
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground break-all">{v}</dd>
    </div>
  );
}

function IdleState({ email }: { email: string }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/30">
        <ShieldCheck className="h-10 w-10 text-primary" />
      </div>
      <p className="mt-5 font-display text-xl font-semibold">All quiet</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        We're listening for sign-in requests for <span className="font-mono text-foreground">{email}</span>.
      </p>
      <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        channel · open
      </div>
    </div>
  );
}

function InstallTip() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div className="mt-10 rounded-xl border border-border bg-surface/60 p-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2 text-foreground"><Smartphone className="h-3.5 w-3.5 text-primary" /> Add to Home Screen</div>
      <p className="mt-1">For one-tap approvals, install Sentinel: tap the share icon in your browser, then "Add to Home Screen".</p>
    </div>
  );
}

function truncate(s: string, n: number) { return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
function detectDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Mobile device";
}
