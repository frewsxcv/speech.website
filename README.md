# speech.website

Proof-of-concept website: text in → speech out, using open text-to-speech models
([Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), [KittenTTS](https://github.com/KittenML/KittenTTS)).
Two variants: a Python server, and a fully in-browser version with no backend.

## Run

```sh
uv run uvicorn server:app --port 8123
```

Then open http://localhost:8123. First launch downloads the ~330MB model from HuggingFace.

## Pieces

- `server.py` — FastAPI app: `POST /api/tts` `{text, voice, speed}` → WAV bytes; `GET /api/voices`.
- `index.html` — single page: textarea, voice/speed controls, `<audio>` player.

## Serverless variant: `browser/`

`browser/index.html` runs TTS entirely in the browser on ONNX Runtime Web —
no Python, no backend. Host it as a static file anywhere (GitHub Pages, S3, …):

```sh
python3 -m http.server 8124 --directory browser
```

Two models, selectable from a dropdown; the visitor's browser downloads weights
from HuggingFace on first use and caches them:

- **Kokoro-82M** via [kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) —
  best quality, 28 voices; ~92 MB quantized on the WASM backend, ~326 MB fp32 on WebGPU.
- **KittenTTS nano** via [kitten-tts-js](https://github.com/Algiras/kitten-tts-js) —
  smallest, 8 voices, ~24 MB. Loaded as plain source with an import map because CDN
  bundlers' Node polyfills defeat its environment detection (see comment in the HTML).

## Swapping models

The BentoML roundup lists alternatives if Kokoro doesn't fit:

- **Piper** — even lighter/faster, slightly more robotic.
- **Chatterbox / XTTS-v2** — voice cloning from a short reference clip (heavier, GPU-preferred).
- **Parler-TTS / Bark** — prompt-controllable style, slower.

Only `tts()` in `server.py` would need to change.
