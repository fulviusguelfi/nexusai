#!/usr/bin/env python3
"""
whisper-worker.py — faster-whisper STT worker for NexusAI
Production version — same JSON protocol as vosk-worker.js.

Protocol (stdin → worker):
  { type: 'init', sampleRate?: number }
  { type: 'chunk', data: '<base64 PCM int16 mono>' }
  { type: 'finalize' }   <- transcribe full buffer, emit final + ready
  { type: 'reset' }      <- discard buffer, emit ready
  { type: 'exit' }

Protocol (worker → stdout):
  { type: 'ready' }
  { type: 'partial', partial: '...' }   <- rolling window transcription (every ~800ms)
  { type: 'final', text: '...' }        <- full buffer transcription on finalize
  { type: 'error', message: '...' }
"""

import sys
import json
import base64
import threading
import time
import numpy as np

# ── Tunables ─────────────────────────────────────────────────────────────────
ROLLING_INTERVAL_S = 0.8    # emit partial every 800ms
ROLLING_WINDOW_S   = 4.0    # use last 4s for rolling transcription (speed vs context)
INTERIM_MODEL      = "base" # fast model for partials (~74MB)
FINAL_MODEL        = "small" # quality model for finalize (~244MB)
SAMPLE_RATE        = 16000
# ─────────────────────────────────────────────────────────────────────────────


def send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def pcm_bytes_to_float32(data: bytes) -> np.ndarray:
    """Convert raw int16 PCM bytes to float32 array in [-1, 1]."""
    arr = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    arr /= 32768.0
    return arr


def transcribe_audio(model, audio: np.ndarray) -> str:
    """Run faster-whisper on float32 audio, return concatenated text."""
    segments, _ = model.transcribe(
        audio,
        beam_size=3,
        language=None,      # auto-detect language (multilingual)
        vad_filter=False,   # no VAD — push-to-talk controls boundaries
        word_timestamps=False,
    )
    return " ".join(s.text.strip() for s in segments).strip()


def main() -> None:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        send({"type": "error", "message": "faster-whisper not installed. Run: pip install faster-whisper"})
        sys.exit(1)

    interim_model: WhisperModel | None = None
    final_model: WhisperModel | None = None
    audio_buffer: list[np.ndarray] = []
    buffer_lock = threading.Lock()
    sample_rate = SAMPLE_RATE
    rolling_active = threading.Event()
    rolling_active.set()

    def rolling_thread() -> None:
        """Background thread: transcribe rolling window for partial results."""
        while rolling_active.is_set():
            time.sleep(ROLLING_INTERVAL_S)
            if interim_model is None:
                continue
            with buffer_lock:
                if not audio_buffer:
                    continue
                total = np.concatenate(audio_buffer)
                window_len = int(ROLLING_WINDOW_S * sample_rate)
                window = total[-window_len:] if len(total) > window_len else total
            try:
                text = transcribe_audio(interim_model, window)
                if text:
                    send({"type": "partial", "partial": text})
            except Exception as e:
                send({"type": "error", "message": f"partial error: {e}"})

    roller = threading.Thread(target=rolling_thread, daemon=True)

    line_buf = ""
    for raw in sys.stdin:
        line_buf += raw
        nl = line_buf.find("\n")
        while nl != -1:
            line = line_buf[:nl].strip()
            line_buf = line_buf[nl + 1:]
            nl = line_buf.find("\n")

            if not line:
                continue

            try:
                msg = json.loads(line)
            except Exception:
                continue

            t = msg.get("type")

            if t == "init":
                sample_rate = msg.get("sampleRate", SAMPLE_RATE)
                try:
                    interim_model = WhisperModel(INTERIM_MODEL, device="cpu", compute_type="int8")
                    if FINAL_MODEL != INTERIM_MODEL:
                        final_model = WhisperModel(FINAL_MODEL, device="cpu", compute_type="int8")
                    else:
                        final_model = interim_model
                    roller.start()
                    send({"type": "ready"})
                except Exception as e:
                    send({"type": "error", "message": f"init failed: {e}"})

            elif t == "chunk":
                if interim_model is None:
                    continue
                try:
                    chunk = pcm_bytes_to_float32(base64.b64decode(msg["data"]))
                    with buffer_lock:
                        audio_buffer.append(chunk)
                except Exception as e:
                    send({"type": "error", "message": f"chunk error: {e}"})

            elif t == "finalize":
                if final_model is None:
                    send({"type": "ready"})
                    continue
                try:
                    with buffer_lock:
                        full = np.concatenate(audio_buffer) if audio_buffer else None
                        audio_buffer.clear()
                    if full is not None and len(full) > 0:
                        text = transcribe_audio(final_model, full)
                        if text:
                            send({"type": "final", "text": text})
                except Exception as e:
                    send({"type": "error", "message": f"finalize error: {e}"})
                send({"type": "ready"})

            elif t == "reset":
                with buffer_lock:
                    audio_buffer.clear()
                send({"type": "ready"})

            elif t == "exit":
                rolling_active.clear()
                sys.exit(0)


if __name__ == "__main__":
    main()
