import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LogOut, Smartphone, Plus, Activity, ShieldCheck, ShieldX, Clock } from "lucide-react";
import { toast } from "sonner";

type Device = { id: string; device_name: string; paired_at: string | null; last_used_at: string | null; created_at: string };
type Challenge = { id: string; status: string; created_at: string; user_agent: string | null; biometric_method: string | null };

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · Sentinel" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<Challenge[]>([]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("dash-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "auth_challenges" }, () => void loadHistory())
      .on("postgres_changes", { event: "*", schema: "public", table: "paired_devices" }, () => void loadDevices())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data } = await supabase.auth.getUser();
    if (data.user) setEmail(data.user.email ?? "");
    await Promise.all([loadDevices(), loadHistory()]);
  }
  async function loadDevices() {
    const { data } = await supabase.from("paired_devices").select("*").order("created_at", { ascending: false });
    setDevices((data as Device[]) ?? []);
  }
  async function loadHistory() {
    const { data } = await supabase.from("auth_challenges").select("*").order("created_at", { ascending: false }).limit(8);
    setHistory((data as Challenge[]) ?? []);
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  async function removeDevice(id: string) {
    const { error } = await supabase.from("paired_devices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Device removed");
    void loadDevices();
  }

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{email}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary"></p>
            <h1 className="mt-2 font-display text-3xl font-semibold">Trusted perimeter</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage paired devices and review recent sign-in approvals.</p>
          </div>
          <Link to="/pair" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95">
            <Plus className="h-4 w-4" /> Pair new device
          </Link>
        </div>

        <section className="mt-10">
          <SectionHead icon={Smartphone} title="Paired devices" hint={`${devices.filter(d => d.paired_at).length} active`} />
          {devices.length === 0 ? (
            <Empty
              text="No phones paired yet."
              cta={<Link to="/pair" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Pair a device</Link>}
            />
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {devices.map((d) => (
                <div key={d.id} className="group flex items-center justify-between rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-display text-sm font-semibold">{d.device_name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {d.paired_at ? `paired ${timeAgo(d.paired_at)}` : "pending pairing"}
                        {d.last_used_at && ` · last used ${timeAgo(d.last_used_at)}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removeDevice(d.id)} className="rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <SectionHead icon={Activity} title="Recent activity" hint="last 8" />
          {history.length === 0 ? (
            <Empty text="No sign-in attempts yet." />
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface/40">
              {history.map((h) => <HistoryRow key={h.id} ch={h} />)}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function SectionHead({ icon: Icon, title, hint }: { icon: typeof Activity; title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
      {hint && <span className="font-mono text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {cta}
    </div>
  );
}

function HistoryRow({ ch }: { ch: Challenge }) {
  const Icon = ch.status === "approved" ? ShieldCheck : ch.status === "pending" ? Clock : ShieldX;
  const color =
    ch.status === "approved" ? "text-success"
    : ch.status === "pending" ? "text-warning"
    : "text-destructive";
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <div>
          <p className="font-mono text-xs">
            <span className="text-foreground">{ch.status}</span>
            {ch.biometric_method && <span className="text-muted-foreground"> · {ch.biometric_method}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground truncate max-w-[260px] sm:max-w-none">{ch.user_agent ?? "—"}</p>
        </div>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">{timeAgo(ch.created_at)}</p>
    </li>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
