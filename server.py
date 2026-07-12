"""Minimal TTS spike server: Kokoro-82M behind a FastAPI endpoint."""

import io

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from kokoro import KPipeline
from pydantic import BaseModel

app = FastAPI(title="TTS Spike")

# Loads the ~330MB model from HuggingFace on first run, then cached.
# 'a' = American English. The pipeline lazily loads per-voice embeddings.
pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")

VOICES = {
    "af_heart": "Heart (US female)",
    "af_bella": "Bella (US female)",
    "af_nicole": "Nicole (US female, whisper)",
    "am_michael": "Michael (US male)",
    "am_fenrir": "Fenrir (US male)",
    "bf_emma": "Emma (UK female)",
    "bm_george": "George (UK male)",
}


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0


@app.get("/")
def index():
    return FileResponse("index.html")


@app.get("/api/voices")
def voices():
    return VOICES


@app.post("/api/tts")
def tts(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text is empty")
    if req.voice not in VOICES:
        raise HTTPException(400, f"unknown voice {req.voice!r}")

    # Kokoro yields one chunk per text segment; concatenate them.
    chunks = [audio for _, _, audio in pipeline(text, voice=req.voice, speed=req.speed)]
    if not chunks:
        raise HTTPException(400, "no audio generated")
    audio = np.concatenate(chunks)

    buf = io.BytesIO()
    sf.write(buf, audio, samplerate=24000, format="WAV")
    return Response(buf.getvalue(), media_type="audio/wav")
