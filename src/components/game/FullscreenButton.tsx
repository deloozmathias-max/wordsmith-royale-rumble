import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    if (busy) return;
    setBusy(true);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        toast.error("Fullscreen isn't available in this browser or embedded player.");
      }
    } catch {
      toast.error("Fullscreen was blocked by your browser or embedded player.");
    } finally {
      setBusy(false);
    }
  }

  const label = fullscreen ? "Exit fullscreen" : "Enter fullscreen";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 size-10 bg-background text-foreground"
      aria-label={label}
      title={label}
      aria-pressed={fullscreen}
      disabled={busy}
      onClick={toggleFullscreen}
    >
      {fullscreen ? <Minimize /> : <Maximize />}
    </Button>
  );
}