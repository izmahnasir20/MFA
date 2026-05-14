import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Smartphone, Zap, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "MFA · Biometric Authentication" },
      {
        name: "description",
        content:
          "Every login confirmed with Face ID or fingerprint on your trusted phone.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />

        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>

          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-24">
        <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] md:text-6xl lg:text-7xl">
          Every login,
          <br />
          <span className="text-primary">approved by your face.</span>
        </h1>

        <p className="mt-6 max-w-lg text-base text-muted-foreground md:text-lg">
          A web sign-in. A push to your phone. Face ID or fingerprint to approve.
          The whole handshake takes about three seconds.
        </p>

        <div className="mt-8 flex gap-3">
          <Link
            to="/signup"
            className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Create account
          </Link>

          <Link
            to="/login"
            className="rounded-lg border px-5 py-3 text-sm font-medium"
          >
            Sign Up
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-8 font-display text-3xl font-semibold md:text-4xl">
          Steps To Follow
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Step
            title="Web login"
            body="User submits credentials on the web app. Backend validates and issues session request."
          />

          <Step
            title="Realtime push"
            body="Secure authentication request is instantly pushed to the registered phone."
          />

          <Step
            title="Biometric approval"
            body="Phone prompts Face ID or fingerprint verification before login approval."
          />

          <Step
            title="Access granted"
            body="Server verifies response and securely grants access to the user."
          />
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <h2 className="mb-8 font-display text-3xl font-semibold md:text-4xl">
          Features
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={Smartphone}
            title="Trusted device"
            body="Login requires a registered trusted phone."
          />

          <Feature
            icon={Zap}
            title="No OTP codes"
            body="Approval happens instantly without SMS or codes."
          />

          <Feature
            icon={ShieldCheck}
            title="Phishing resistant"
            body="Biometric approval is tied to device security."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-8 text-xs text-muted-foreground">
          <p className="font-display text-lg font-semibold">MFA</p>
          
        </div>
      </footer>
    </div>
  );
}

/* ✅ FIXED STEP COMPONENT (no icons, no numbers) */
function Step({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 transition hover:bg-surface-2">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

/* Feature stays same */
function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Smartphone;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-6">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}