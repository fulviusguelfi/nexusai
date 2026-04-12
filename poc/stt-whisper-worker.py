#!/usr/bin/env python3
"""
PoC: faster-whisper as drop-in replacement for vosk-worker.js
Same JSON-over-stdin/stdout protocol.

Protocol (stdin → worker):
  { type: 'init', sampleRate?: number, model?: string }
  { type: 'chunk', data: '<base64 PCM int16 mono>' }
  { type: 'finalize' }   <- transcribe buffered audio + send final + ready
  { type: 'reset' }      <- discard buffer
  { type: 'exit' }

Protocol (worker → stdout):
  { type: 'ready' }
  { type: 'partial', partial: '...' }   <- rolling window transcription
  { type: 'final', text: '...' }
  { type: 'error', message: '...' }

Streaming strategy:
  - Audio is accumulated in a ring buffer
  - Every ROLLING_INTERVAL_S seconds, the latest window is transcribed
    by a background thread → emitted as 'partial'
  - On 'finalize', the full buffer is transcribed → emitted as 'final'
  - Push-to-talk: host sends chunks while button held, 'finalize' on release

Install:
  pip install faster-whisper

Models (downloaded automatically on first use):
  tiny   ~39M  fastest, lower quality
  base   ~74M  good balance for interim
  small  ~244M recommended for final quality
  medium ~769M better multilingual
"""

import sys
import json
import base64
import threading
import time
import io
import numpy as np

# ── tunables ─────────────────────────────────────────────────────────────────
ROLLING_INTERVAL_S = 0.8    # emit partial every 0.8s
ROLLING_WINDOW_S   = 4.0    # use last 4s for rolling transcription
DEFAULT_MODEL      = "base" # interim model; final uses 'small'
FINAL_MODEL        = "small"
SAMPLE_RATE        = 16000
# ─────────────────────────────────────────────────────────────────────────────

def send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def pcm_bytes_to_float32(data: bytes) -> np.ndarray:
    """Convert raw int16 PCM bytes to float32 array in [-1, 1]."""
    arr = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    arr /= 32768.0
    return arr

def transcribe_audio(model, audio_float32: np.ndarray, language=None) -> str:
    """Run faster-whisper on float32 audio array, return concatenated text."""
    segments, _info = model.transcribe(
        audio_float32,
        beam_size=3,
        language=language,          # None = auto-detect
        vad_filter=False,           # no VAD — push-to-talk controls boundaries
        word_timestamps=False,
    )
    return " ".join(s.text.strip() for s in segments).strip()

def main():
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        send({"type": "error", "message": "faster-whisper not installed. Run: pip install faster-whisper"})
        sys.exit(1)

    # State
    interim_model = None
    final_model = None
    audio_buffer: list[np.ndarray] = []   # accumulated float32 chunks
    buffer_lock = threading.Lock()
    sample_rate = SAMPLE_RATE
    language = None   # None = auto-detect

    # Rolling transcription thread
    rolling_active = threading.Event()
    rolling_active.set()

    def rolling_thread():
        """Background thread: every ROLLING_INTERVAL_S, transcribe the last window."""
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
                text = transcribe_audio(interim_model, window, language)
                if text:
                    send({"type": "partial", "partial": text})
            except Exception as e:
                send({"type": "error", "message": f"partial transcription error: {e}"})

    roller = threading.Thread(target=rolling_thread, daemon=True)

    input_buf = ""

    for raw_line in sys.stdin:
        input_buf += raw_line
        newline_pos = input_buf.find("\n")
        while newline_pos != -1:
            line = input_buf[:newline_pos].strip()
            input_buf = input_buf[newline_pos + 1:]
            newline_pos = input_buf.find("\n")

            if not line:
                continue

            try:
                msg = json.loads(line)
            except Exception:
                continue

            t = msg.get("type")

            if t == "init":
                sample_rate = msg.get("sampleRate", SAMPLE_RATE)
                model_name = msg.get("model", DEFAULT_MODEL)
                try:
                    # Load both models (cpu+int8 for speed; change to 'cuda' if GPU available)
                    device = "cpu"
                    compute = "int8"
                    send({"type": "partial", "partial": f"Loading {model_name} model..."})
                    interim_model = WhisperModel(model_name, device=device, compute_type=compute)
                    if FINAL_MODEL != model_name:
                        send({"type": "partial", "partial": f"Loading {FINAL_MODEL} model..."})
                        final_model = WhisperModel(FINAL_MODEL, device=device, compute_type=compute)
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
                    pcm_bytes = base64.b64decode(msg["data"])
                    chunk_f32 = pcm_bytes_to_float32(pcm_bytes)
                    with buffer_lock:
                        audio_buffer.append(chunk_f32)
                except Exception as e:
                    send({"type": "error", "message": f"chunk error: {e}"})

            elif t == "finalize":
                if final_model is None:
                    send({"type": "ready"})
                    continue
                try:
                    with buffer_lock:
                        if audio_buffer:
                            full_audio = np.concatenate(audio_buffer)
                        else:
                            full_audio = None
                        audio_buffer.clear()
                    if full_audio is not None and len(full_audio) > 0:
                        text = transcribe_audio(final_model, full_audio, language)
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
