import { Link } from "@tanstack/react-router";
import { Trophy, Users } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-lg font-extrabold leading-none tracking-tight ${className}`}>
      SYNONYM<span className="text-primary">/</span>ROYALE
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" aria-label="Synonym Royale home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            to="/"
            className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Play
          </Link>
          <Link
            to="/leaderboard"
            search={{ period: "all" }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            <Trophy className="size-4" /> <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          <Link
            to="/friends"
            aria-label="Friends"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            <Users className="size-4" /> <span className="hidden sm:inline">Friends</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
