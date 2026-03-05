import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WinClawConfig } from "../config/config.js";

const { runAudioTranscription } = vi.hoisted(() => {
  const runAudioTranscription = vi.fn();
  return { runAudioTranscription };
});

vi.mock("./audio-transcription-runner.js", () => ({
  runAudioTranscription,
}));

import { transcribeAudioFile } from "./transcribe-audio.js";

describe("transcribeAudioFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not force audio/wav when mime is omitted", async () => {
    runAudioTranscription.mockResolvedValue({ transcript: "hello", attachments: [] });

    const result = await transcribeAudioFile({
      filePath: "/tmp/note.mp3",
      cfg: {} as WinClawConfig,
    });

    expect(runAudioTranscription).toHaveBeenCalledWith({
      ctx: {
        MediaPath: "/tmp/note.mp3",
        MediaType: undefined,
      },
      cfg: {} as WinClawConfig,
      agentDir: undefined,
    });
    expect(result).toEqual({ text: "hello" });
  });

  it("returns undefined when helper returns no transcript", async () => {
    runAudioTranscription.mockResolvedValue({ transcript: undefined, attachments: [] });

    const result = await transcribeAudioFile({
      filePath: "/tmp/missing.wav",
      cfg: {} as WinClawConfig,
    });

    expect(result).toEqual({ text: undefined });
  });

  it("propagates helper errors", async () => {
    const cfg = {
      tools: { media: { audio: { timeoutSeconds: 10 } } },
    } as unknown as WinClawConfig;
    runAudioTranscription.mockRejectedValue(new Error("boom"));

    await expect(
      transcribeAudioFile({
        filePath: "/tmp/note.wav",
        cfg,
      }),
    ).rejects.toThrow("boom");
  });
});
