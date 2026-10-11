"use client";

import { Mic, Send, Sparkles, Square } from "lucide-react";
import { motion } from "motion/react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { api, ApiRequestError } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import type { AssistantCommand, UserMode } from "@/lib/types";

interface SpeechResultEvent {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

interface SpeechErrorEvent {
  error: string;
}

interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type SpeechRecognizerConstructor = new () => SpeechRecognizer;

function speechRecognizer(): SpeechRecognizerConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function ClaudeAssistant({
  mode,
  onCommand,
  watchingLabel,
}: {
  mode: UserMode;
  onCommand: (command: AssistantCommand) => Promise<void>;
  watchingLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const recognition = useRef<SpeechRecognizer | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopListening = useCallback(() => {
    recognition.current?.abort();
    recognition.current = null;
    setListening(false);
  }, []);

  const close = useCallback(() => {
    stopListening();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(false);
  }, [stopListening]);

  useEffect(() => () => {
    recognition.current?.abort();
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pending) return;
      stopListening();
      setPending(true);
      setError(null);
      setReply(null);
      try {
        const command = await api.assistantCommand(text);
        setReply(command.reply);
        await onCommand(command);
        haptic("success");
        if (command.action !== "HELP") {
          closeTimer.current = setTimeout(() => setOpen(false), 900);
        }
      } catch (caught) {
        haptic("error");
        setError(caught instanceof ApiRequestError || caught instanceof Error ? caught.message : "Claude couldn't complete that. Try again.");
      } finally {
        setPending(false);
      }
    },
    [onCommand, pending, stopListening],
  );

  const startListening = useCallback(() => {
    if (pending || listening) return;
    const Recognition = speechRecognizer();
    if (!Recognition) {
      setVoiceUnavailable(true);
      return;
    }
    setVoiceUnavailable(false);
    setError(null);
    setReply(null);
    const next = new Recognition();
    next.lang = "en-US";
    next.continuous = false;
    next.interimResults = false;
    next.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (!transcript) return;
      setMessage(transcript);
      void run(transcript);
    };
    next.onerror = (event) => {
      if (event.error !== "aborted") setError("I couldn't hear that. Try speaking again or type your request.");
    };
    next.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = next;
    setListening(true);
    try {
      next.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setError("Voice input couldn't start. Type your request below.");
    }
  }, [listening, pending, run]);

  const launch = () => {
    haptic("tick");
    setOpen(true);
    setMessage("");
    setReply(null);
    setError(null);
    startListening();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(message);
  };

  return (
    <>
      <motion.button
        type="button"
        aria-label={watchingLabel ? `Claude is watching for rides to ${watchingLabel}` : "Open Claude assistant"}
        title="Claude assistant"
        whileTap={{ scale: 0.94 }}
        onClick={launch}
        className="glass-chip pointer-events-auto relative flex size-12 items-center justify-center rounded-full text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Sparkles aria-hidden size={21} strokeWidth={2.2} />
        {watchingLabel && <span aria-hidden className="absolute right-0.5 top-0.5 size-3 rounded-full border-2 border-surface-raised bg-success" />}
      </motion.button>

      <Sheet
        open={open}
        onClose={close}
        title="Claude assistant"
        description={mode === "RIDER" ? "Say where you want to go and I’ll book it." : "Name a destination and I’ll watch for matching rides."}
      >
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={pending}
            className={`mx-auto flex size-20 items-center justify-center rounded-full transition-colors ${listening ? "bg-accent text-on-accent" : "bg-brand text-on-brand"}`}
          >
            {listening ? <Square aria-hidden size={25} fill="currentColor" /> : <Mic aria-hidden size={29} />}
            <span className="sr-only">{listening ? "Stop listening" : "Start listening"}</span>
          </button>

          <div className="text-center" aria-live="polite">
            <p className="text-label font-semibold text-ink">
              {pending ? "Claude is working…" : listening ? "Listening…" : watchingLabel ? `Watching for ${watchingLabel}` : "Tap the microphone or type below"}
            </p>
            {voiceUnavailable && <p className="mt-1 text-caption text-ink-muted">Voice input isn’t available in this browser. Typed requests work normally.</p>}
            {reply && <p className="mt-2 text-label font-normal text-success">{reply}</p>}
            {error && <p role="alert" className="mt-2 text-label font-normal text-danger">{error}</p>}
          </div>

          <form onSubmit={submit} className="flex items-end gap-2">
            <Input
              label="Ask Claude"
              hideLabel
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={mode === "RIDER" ? "Book from The Yard to Busch…" : "Find rides ending at Cook…"}
              disabled={pending}
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              size="md"
              block={false}
              loading={pending}
              disabled={!message.trim()}
              aria-label="Send request"
              className="size-[52px] shrink-0 px-0"
            >
              <Send aria-hidden size={19} />
            </Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
