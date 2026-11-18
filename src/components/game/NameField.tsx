import { useEffect, useState } from "react";
import { ShieldCheck, Wand2 } from "lucide-react";
import { defaultPlayerName, validatePlayerName } from "@/lib/game/filter";

type Props = {
  initial: string;
  error: string | null;
  onChange: (value: string) => void;
  onUseSuggestion: (name: string) => void;
};

export function NameField({ initial, error, onChange, onUseSuggestion }: Props) {
  const [value, setValue] = useState(initial);
  const [suggestion, setSuggestion] = useState("");
  useEffect(() => setValue(initial), [initial]);
  useEffect(() => setSuggestion(defaultPlayerName()), [error]);

  const live = value ? validatePlayerName(value) : null;
  const shownError = error ?? (live && !live.ok && value.length >= 3 ? live.error : null);

  return (
    <div>
      <label htmlFor="player-name" className="kicker">
        Your player name
      </label>
      <div className="relative mt-2">
        <input
          id="player-name"
          value={value}
          maxLength={16}
          autoComplete="nickname"
          placeholder="e.g. WordWizard"
          aria-invalid={!!shownError}
          aria-describedby="name-help"
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value);
          }}
          className={`h-14 w-full rounded-xl border bg-background px-4 pr-12 font-display text-xl font-semibold outline-none transition-colors placeholder:text-muted-foreground/50 ${
            shownError ? "border-destructive" : "border-input focus:border-primary"
          }`}
        />
        {live?.ok && <ShieldCheck className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-primary" />}
      </div>
      <div id="name-help" className="mt-2 min-h-6 text-sm" role="alert">
        {shownError ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-destructive">
            {shownError}
            <button
              type="button"
              onClick={() => {
                setValue(suggestion);
                onUseSuggestion(suggestion);
              }}
              className="inline-flex items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline"
            >
              <Wand2 className="size-3.5" /> Use “{suggestion}”
            </button>
          </span>
        ) : (
          <span className="text-muted-foreground">3–16 characters. Keep it clean — rude names are blocked.</span>
        )}
      </div>
    </div>
  );
}
