import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/40 transition group-hover:bg-primary/25">
        <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={2.5} />
        <span className="absolute inset-0 rounded-lg bg-primary/0 transition group-hover:bg-primary/10" />
      </div>
      <div className="font-display text-base font-semibold tracking-tight">
        MFA<span className="text-primary"></span>
      </div>
    </Link>
  );
}
