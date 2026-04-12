#!/usr/bin/env python3
"""
PoC: RealtimeSTT as drop-in replacement for vosk-worker.js
Same JSON-over-stdin/stdout protocol.

Protocol (stdin → worker):
  { type: 'init', sampleRate?: number }
  { type: 'chunk', data: '<base64 PCM int16 mono>' }
  { type: 'finalize' }   <- flush current buffer, send final + ready
  { type: 'reset' }
  { type: 'exit' }

Protocol (worker → stdout):
  { type: 'ready' }
  { type: 'partial', partial: '...' }
  { type: 'final', text: '...' }    <- committed sentence (on finalize)
  { type: 'error', message: '...' }

Install:
  pip install RealtimeSTT
  # RealtimeSTT will download the Whisper model on first run

Key differences from Vosk:
  - Multilingual (auto-detect by default)
  - Uses Whisper model internally (much higher quality)
  - 'realtime_model_type' = smaller model for interim (speed)
  - 'model' = main model for final (quality)
"""

import sys
import json
import base64
import threading

def send(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def main():
    try:
        from RealtimeSTT import AudioToTextRecorder
    except ImportError:
        send({"type": "error", "message": "RealtimeSTT not installed. Run: pip install RealtimeSTT"})
        sys.exit(1)

    recorder = None
    sample_rate = 16000
    last_partial = ""
    partial_lock = threading.Lock()

    def on_realtime_update(text):
        nonlocal last_partial
        with partial_lock:
            last_partial = text
        send({"type": "partial", "partial": text})

    def on_transcription_complete(text):
        # Called when Whisper finalizes a sentence (silence-triggered).
        # In push-to-talk mode we disable VAD so this fires on finalize command.
        send({"type": "sentence", "text": text})

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
                sample_rate = msg.get("sampleRate", 16000)
                try:
                    recorder = AudioToTextRecorder(
                        use_microphone=False,
                        model="small",                        # main model: quality
                        realtime_model_type="tiny",           # interim model: speed
                        language="",                          # "" = auto-detect multilingual
                        silero_sensitivity=0.01,              # near-zero VAD (push-to-talk controls start/stop)
                        silero_use_onnx=True,                 # faster VAD
                        webrtc_sensitivity=0,
                        post_speech_silence_duration=60.0,    # very long = effectively disabled
                        min_length_of_recording=0,
                        min_gap_between_recordings=0,
                        enable_realtime_transcription=True,
                        realtime_processing_pause=0.1,        # emit interim every 100ms
                        on_realtime_transcription_update=on_realtime_update,
                        on_transcription_complete=on_transcription_complete,
                        spinner=False,
                        level=0,                              # suppress logs
                    )
                    send({"type": "ready"})
                except Exception as e:
                    send({"type": "error", "message": f"init failed: {e}"})

            elif t == "chunk":
                if recorder is None:
                    continue
                try:
                    pcm_bytes = base64.b64decode(msg["data"])
                    # RealtimeSTT expects float32 or int16; feed_audio accepts bytes
                    recorder.feed_audio(pcm_bytes, original_sample_rate=sample_rate)
                except Exception as e:
                    send({"type": "error", "message": f"chunk error: {e}"})

            elif t == "finalize":
                if recorder is None:
                    send({"type": "ready"})
                    continue
                try:
                    # Force transcription of whatever is buffered
                    text = recorder.stop_recording_and_get_text()
                    if text and text.strip():
                        send({"type": "final", "text": text.strip()})
                    with partial_lock:
                        last_partial = ""
                    # Restart for next utterance
                    recorder.start_recording()
                except Exception as e:
                    send({"type": "error", "message": f"finalize error: {e}"})
                send({"type": "ready"})

            elif t == "reset":
                with partial_lock:
                    last_partial = ""
                if recorder:
                    try:
                        recorder.stop_recording_and_get_text()
                        recorder.start_recording()
                    except Exception:
                        pass
                send({"type": "ready"})

            elif t == "exit":
                if recorder:
                    try:
                        recorder.stop_recording_and_get_text()
                        recorder.stop()
                    except Exception:
                        pass
                sys.exit(0)

if __name__ == "__main__":
    main()
