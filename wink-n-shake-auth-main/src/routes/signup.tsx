import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Mail, Lock as LockIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account · Sentinel" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — let's pair your phone.");
    navigate({ to: "/pair" });
  }

  return (
    <AuthShell title="Create your account" subtitle="Then pair a phone to use as your second factor.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="your gmail@.com" />
        <Field icon={LockIcon} label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" minLength={8} />
        <button type="submit" disabled={loading} className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Have an account? <Link to="/login" className="text-foreground underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <header className="relative z-10 mx-auto max-w-6xl px-6 py-6"><Logo /></header>
      <main className="relative z-10 mx-auto flex max-w-md flex-col px-6 pt-10 pb-20">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary"></p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="glass mt-8 rounded-2xl p-6">{children}</div>
      </main>
    </div>
  );
}

export function Field({
  icon: Icon, label, type = "text", value, onChange, placeholder, minLength,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <input
          required
          minLength={minLength}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </label>
  );
}
