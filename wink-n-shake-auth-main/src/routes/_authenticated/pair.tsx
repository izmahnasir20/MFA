import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { generatePairingCode } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Copy, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pair")({
  component: PairPage,
  head: () => ({ meta: [{ title: "Pair a device · Sentinel" }] }),
});

function PairPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [origin, setOrigin] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setOrigin(window.location.origin);
    void initialize();
    return () => { if (channelRef.current) void supabase.removeChannel(channelRef.current); };
  }, []);

  async function initialize() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const c = generatePairingCode();
    const { data, error } = await supabase
      .from("paired_devices")
      .insert({ user_id: u.user.id, pairing_code: c, device_name: "My phone" })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not generate pairing code");
      return;
    }
    setCode(c);
    setDeviceId(data.id);

    const channel = supabase
      .channel(`pair:${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "paired_devices", filter: `id=eq.${data.id}` },
        (payload) => {
          const next = payload.new as { paired_at: string | null };
          if (next.paired_at) setPaired(true);
        }
      )
      .subscribe();
    channelRef.current = channel;
  }

  const url = code && origin ? `${origin}/m?pair=${code}` : "";

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <header className="relative z-10 mx-auto max-w-6xl px-6 py-6"><Logo /></header>

      <main className="relative z-10 mx-auto grid max-w-5xl gap-10 px-6 pb-20 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary"></p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">Add your phone</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Open the camera on your phone and scan the QR code, or open the URL directly.
            Sign in once on your phone to bind it as your trusted device.
          </p>

          <ol className="mt-8 space-y-3">
            {[
              "Scan the QR code with your phone's camera.",
              "Sign in with the same account on the page that opens.",
              "Add Sentinel to your home screen for one-tap approvals.",
              "From now on, every web sign-in needs a biometric tap.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 font-mono text-[11px] text-primary">{i + 1}</span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ol>

          {paired ? (
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-success/40 bg-success/10 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-success/20"><Check className="h-5 w-5 text-success" /></div>
                <div>
                  <p className="font-display text-sm font-semibold">Phone paired</p>
                  <p className="font-mono text-[11px] text-muted-foreground">You can now approve sign-ins.</p>
                </div>
              </div>
              <button onClick={() => navigate({ to: "/dashboard" })} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="font-mono">listening for pair confirmation…</span>
            </div>
          )}

          <Link to="/dashboard" className="mt-8 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline">
            Skip for now
          </Link>
        </div>

        <div className="lg:sticky lg:top-10">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"></p>
            
            </div>

            <div className="mt-4 flex justify-center rounded-2xl bg-white p-5 border border-border">
              {url ? (
                <QRCodeSVG value={url} size={240} bgColor="#ffffff" fgColor="#000000" level="M" />
              ) : (
                <div className="grid h-[240px] w-[240px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              )}
            </div>

            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">pairing code</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.25em] text-primary">{code ?? "————————"}</p>
            </div>

            {url && (
              <button
                onClick={() => { void navigator.clipboard.writeText(url); toast.success("URL copied"); }}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs font-mono text-muted-foreground hover:bg-surface"
              >
                <Copy className="h-3 w-3" /> copy pairing URL
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
