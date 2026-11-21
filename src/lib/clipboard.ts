/** Copies text; works in sandboxed iframes and non-HTTPS pages too. Never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Blocked by the iframe's permissions: try the old way below.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Opens the phone's share sheet when available. Resolves false when not shared. */
export async function nativeShare(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}
