import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyText, nativeShare } from "@/lib/clipboard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  text: string;
  children?: ReactNode;
};

/** Shows a link or result with Copy (and Share on phones). The text stays selectable if copying is blocked. */
export function ShareDialog({ open, onOpenChange, title, description, text, children }: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  useEffect(() => {
    if (!open) {
      setCopied(false);
      setFailed(false);
    }
  }, [open]);

  async function copy() {
    const ok = await copyText(text);
    setCopied(ok);
    setFailed(!ok);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <textarea
          readOnly
          value={text}
          rows={Math.min(6, text.split("\n").length + 1)}
          aria-label={title}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-xl border border-input bg-background p-3 font-mono text-sm outline-none focus:border-primary"
        />
        {failed && <p className="text-sm text-muted-foreground">Copying is blocked here — select the text above and copy it yourself.</p>}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="hero" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied!" : "Copy"}
          </Button>
          {canShare && (
            <Button variant="arena" onClick={() => void nativeShare({ title: "Synonym Royale", text })}>
              <Share2 /> Share
            </Button>
          )}
          {children}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
