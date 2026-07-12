# speech.website

Text in → speech out, running entirely in the browser: open text-to-speech
models on [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
(WebGPU when available, WASM otherwise). No backend — host it as static files.

## Run locally

```sh
python3 -m http.server 8124
```

Then open http://localhost:8124. The browser downloads model weights from
HuggingFace on first use and caches them.

## Models

Selectable from a dropdown:

- **Kokoro-82M** via [kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) —
  best quality, 28 voices; ~92 MB quantized on the WASM backend, ~326 MB fp32 on WebGPU.
- **KittenTTS nano** via [kitten-tts-js](https://github.com/Algiras/kitten-tts-js) —
  smallest, 8 voices, ~24 MB. Loaded as plain source with an import map because CDN
  bundlers' Node polyfills defeat its environment detection (see comment in the HTML).
