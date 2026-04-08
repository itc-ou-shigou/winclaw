/**
 * Media intent helper.
 *
 * Hard rules:
 *   - Never mutates existing provider classes.
 *   - Stores intent under meta.ext.mediaIntent (a previously unused namespace).
 *   - Flag OFF: tagIntent() is a passthrough returning the input envelope unchanged.
 *   - readIntent() returns null if the namespace is absent or malformed.
 *   - On any error, helpers return the safe default (input or null).
 */

export type MediaIntentKind = "voice" | "image" | "video" | "music" | "text";

export interface MediaIntent {
  readonly kind: MediaIntentKind;
  readonly origin: string;
  readonly setAt: number;
  readonly hint?: string;
}

export interface EnvelopeLike {
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export function isMediaIntentEnabled(): boolean {
  return process.env.AVATAR_EXT_MEDIA_INTENT === "1";
}

export function tagIntent<E extends EnvelopeLike>(
  envelope: E,
  intent: Pick<MediaIntent, "kind" | "origin" | "hint">
): E {
  if (!isMediaIntentEnabled()) return envelope;
  try {
    const meta = (envelope.meta ?? {}) as Record<string, unknown>;
    const ext = (meta.ext ?? {}) as Record<string, unknown>;
    const next: MediaIntent = {
      kind: intent.kind,
      origin: intent.origin,
      hint: intent.hint,
      setAt: Date.now(),
    };
    return {
      ...envelope,
      meta: { ...meta, ext: { ...ext, mediaIntent: next } },
    };
  } catch {
    return envelope;
  }
}

export function readIntent(envelope: EnvelopeLike | null | undefined): MediaIntent | null {
  if (!envelope) return null;
  try {
    const meta = envelope.meta as Record<string, unknown> | undefined;
    if (!meta) return null;
    const ext = meta.ext as Record<string, unknown> | undefined;
    if (!ext) return null;
    const raw = ext.mediaIntent as Partial<MediaIntent> | undefined;
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.kind !== "string") return null;
    if (typeof raw.origin !== "string") return null;
    if (typeof raw.setAt !== "number") return null;
    return {
      kind: raw.kind as MediaIntentKind,
      origin: raw.origin,
      setAt: raw.setAt,
      hint: typeof raw.hint === "string" ? raw.hint : undefined,
    };
  } catch {
    return null;
  }
}

export function clearIntent<E extends EnvelopeLike>(envelope: E): E {
  if (!envelope.meta) return envelope;
  try {
    const meta = { ...(envelope.meta as Record<string, unknown>) };
    const ext = meta.ext ? { ...(meta.ext as Record<string, unknown>) } : null;
    if (ext) {
      delete ext.mediaIntent;
      meta.ext = ext;
    }
    return { ...envelope, meta };
  } catch {
    return envelope;
  }
}
