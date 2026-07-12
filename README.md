# speech.website

Text in → speech out, running entirely in the browser: open text-to-speech
models on [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
(WebGPU when available, WASM otherwise). No backend — host it as static files.

## Run locally

```sh
npm install
npm run dev
```

React + [MUI](https://mui.com/) frontend built with Vite; `npm run build` outputs
static files to `dist/` (deployed to GitHub Pages by CI). The TTS libraries are
loaded at runtime from CDNs (see `src/models.js` for why), and the browser
downloads model weights from HuggingFace on first use and caches them.

## Models

Selectable from a dropdown:

- **Kokoro-82M** via [kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) —
  best quality, 28 voices; ~92 MB quantized on the WASM backend, ~326 MB fp32 on WebGPU.
- **KittenTTS nano** via [kitten-tts-js](https://github.com/Algiras/kitten-tts-js) —
  smallest, 8 voices, ~24 MB. Loaded as plain source with an import map because CDN
  bundlers' Node polyfills defeat its environment detection (see comment in the HTML).
- **Piper** via [@mintplex-labs/piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web) —
  curated subset of its 900+ voice catalog across 10 languages; each voice is its own
  ~65 MB download, cached in origin-private FS.
- **MMS-TTS (Meta)** via [Transformers.js](https://huggingface.co/docs/transformers.js) —
  one model per language (12 wired up), ~36 MB each, loaded lazily per language.
- **OuteTTS-0.2-500M** via [outetts](https://www.npmjs.com/package/outetts) — LLM-based
  TTS with speaker profiles, ~330 MB q4; slower than real time, WebGPU strongly
  recommended. (q4f16 is broken in Chrome with native Float16Array — see comment.)
