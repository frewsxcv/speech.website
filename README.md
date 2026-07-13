# speech.website

Text in → speech out, running entirely in the browser: open text-to-speech
models on [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
(WebGPU when available, WASM otherwise). No backend; host it as static files.

## Run locally

```sh
npm install
npm run dev
```

React + [MUI](https://mui.com/) frontend built with Vite; `npm run build` outputs
static files to `dist/` (deployed to GitHub Pages by CI). The TTS libraries are
loaded at runtime from CDNs (see `src/models.ts` for why), and the browser
downloads model weights from HuggingFace on first use and caches them.
