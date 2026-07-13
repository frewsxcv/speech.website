// Model registry. Each loader returns an Engine: { voices, generate(text, voiceId) }.
//
// The TTS libraries are imported at runtime from CDNs (with @vite-ignore so
// Vite leaves the URLs alone) rather than bundled: several of them misdetect
// their environment when a bundler's Node polyfills are present, and this way
// each library is only fetched when its model is selected. They ship no type
// declarations, so each dynamic import resolves via the ambient wildcard
// module in cdn-modules.d.ts and its exports are `any`.

export const webgpu = !!navigator.gpu;

const ORT_DIST = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";

// onnxruntime-web's WebGPU execution provider is still experimental and has
// known gaps outside Chromium (observed on Safari: a broken internal
// iteration crashes model loading by rejecting a promise *detached* from
// the one the library returns to its caller, which a normal try/catch
// around that returned promise can't see at all — it just hangs forever).
// Race the load against the window's unhandledrejection event so a
// detached failure surfaces here too, letting callers fall back to the
// far more broadly-supported WASM backend instead of leaving the UI stuck.
function guardDetachedRejection<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const onRejection = (e: PromiseRejectionEvent) => {
      cleanup();
      reject(e.reason);
    };
    const cleanup = () => window.removeEventListener("unhandledrejection", onRejection);
    window.addEventListener("unhandledrejection", onRejection);
    promise.then(
      (v) => { cleanup(); resolve(v); },
      (e) => { cleanup(); reject(e); },
    );
  });
}

export interface ModelLink {
  label: string;
  url: string;
}

export interface Voice {
  id: string;
  label: string;
}

export interface ProgressInfo {
  status: string;
  // Downloads are reported per source file, not in aggregate: a model with
  // several files (weights, tokenizer, config, ...) restarts loaded/total
  // from zero for each one, so callers must key on `file` to sum progress
  // across files instead of reading loaded/total from a single event.
  file?: string;
  loaded?: number;
  total?: number;
}

export type OnProgress = (p: ProgressInfo) => void;

export type GenerateResult =
  | { samples: Float32Array; rate: number; blob?: undefined }
  | { blob: Blob; samples?: undefined; rate?: undefined };

export interface Engine {
  voices: Voice[];
  generate(text: string, voice: string): Promise<GenerateResult>;
}

export interface ModelEntry {
  name: string;
  detail: string;
  links: ModelLink[];
  load(onProgress?: OnProgress): Promise<Engine>;
}

// Ordered from highest to lowest speech quality, as reflected in the picker.
export const MODELS: Record<string, ModelEntry> = {
  kokoro: {
    name: "Kokoro-82M",
    detail: `Best quality · 28 voices · ~${webgpu ? 326 : 92} MB`,
    links: [
      { label: "Model card", url: "https://huggingface.co/hexgrad/Kokoro-82M" },
      { label: "ONNX weights", url: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX" },
      { label: "kokoro-js", url: "https://github.com/hexgrad/kokoro/tree/main/kokoro.js" },
    ],
    async load(onProgress) {
      const { KokoroTTS } = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm"
      );
      const loadWith = (useWebgpu: boolean) =>
        KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: useWebgpu ? "fp32" : "q8",
          device: useWebgpu ? "webgpu" : "wasm",
          progress_callback: onProgress,
        });
      let tts;
      try {
        tts = await guardDetachedRejection(loadWith(webgpu));
      } catch (err) {
        if (!webgpu) throw err;
        tts = await loadWith(false);
      }
      return {
        voices: Object.entries(tts.voices).map(([id, v]: [string, any]) =>
          ({ id, label: `${v.name} (${v.language} ${v.gender})` })),
        async generate(text, voice) {
          const audio = await tts.generate(text, { voice });
          return { samples: audio.audio, rate: audio.sampling_rate };
        },
      };
    },
  },
  oute: {
    name: "OuteTTS-0.2-500M",
    detail: "LLM speech, speaker profiles · ~330 MB" + (webgpu ? "" : " · slow without WebGPU"),
    links: [
      { label: "ONNX weights", url: "https://huggingface.co/onnx-community/OuteTTS-0.2-500M" },
      { label: "OuteTTS", url: "https://github.com/edwko/OuteTTS" },
    ],
    async load() {
      const { HFModelConfig_v1, InterfaceHF } = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/outetts@0.2.0/+esm"
      );
      const loadWith = (useWebgpu: boolean) => {
        const cfg = new HFModelConfig_v1({
          model_path: "onnx-community/OuteTTS-0.2-500M",
          language: "en",
          // q4f16 breaks: outetts pins transformers.js 3.1.2, which predates
          // Chrome's native Float16Array and mishandles fp16 tensors there.
          dtype: "q4",
          device: useWebgpu ? "webgpu" : "wasm",
        });
        return InterfaceHF({ model_version: "0.2", cfg });
      };
      let iface;
      try {
        iface = await guardDetachedRejection(loadWith(webgpu));
      } catch (err) {
        if (!webgpu) throw err;
        iface = await loadWith(false);
      }
      const speakers = ["random", "en_male_1", "en_male_2", "en_male_3", "en_male_4",
                        "en_female_1", "en_female_2"];
      return {
        voices: speakers.map((s) => ({ id: s, label: s.replaceAll("_", " ") })),
        async generate(text, voice) {
          let speaker = null;
          if (voice !== "random") {
            try { speaker = iface.load_default_speaker(voice); }
            catch { speaker = iface.load_default_speaker(voice.replace(/^en_/, "")); }
          }
          const out = await iface.generate({
            text, speaker, temperature: 0.1, repetition_penalty: 1.1, max_length: 4096,
          });
          return { blob: new Blob([out.to_wav("output.wav")], { type: "audio/wav" }) };
        },
      };
    },
  },
  piper: {
    name: "Piper",
    detail: "Fast on CPU · 900+ voice catalog · ~65 MB per voice",
    links: [
      { label: "Project", url: "https://github.com/OHF-Voice/piper1-gpl" },
      { label: "Voice catalog", url: "https://huggingface.co/rhasspy/piper-voices" },
      { label: "Voice samples", url: "https://rhasspy.github.io/piper-samples/" },
      { label: "piper-tts-web", url: "https://github.com/Mintplex-Labs/piper-tts-web" },
    ],
    async load() {
      const piper = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm"
      );
      const curated = [
        "en_US-hfc_female-medium", "en_US-lessac-medium", "en_US-amy-medium",
        "en_US-ryan-high", "en_GB-alan-medium", "en_GB-alba-medium",
        "de_DE-thorsten-medium", "fr_FR-siwis-medium", "es_ES-sharvard-medium",
        "it_IT-paola-medium", "pt_BR-faber-medium", "ru_RU-irina-medium",
        "uk_UA-ukrainian_tts-medium", "zh_CN-huayan-medium",
      ];
      const available = new Set((await piper.voices()).map((v: any) => v.key ?? v.id ?? v));
      return {
        voices: curated.filter((id) => available.has(id)).map((id) => ({ id, label: id })),
        async generate(text, voice) {
          // Each voice downloads on first use, then persists in origin-private FS.
          const blob = await piper.predict({ text, voiceId: voice });
          return { blob };
        },
      };
    },
  },
  mms: {
    name: "MMS-TTS (Meta)",
    detail: "12 languages · ~36 MB each",
    links: [
      { label: "Model card", url: "https://huggingface.co/facebook/mms-tts" },
      { label: "MMS docs", url: "https://huggingface.co/docs/transformers/model_doc/mms" },
      { label: "ONNX weights", url: "https://huggingface.co/Xenova/mms-tts-eng" },
    ],
    async load(onProgress) {
      const { pipeline } = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js"
      );
      const langs: Record<string, string> = {
        eng: "English", spa: "Spanish", fra: "French", deu: "German",
        por: "Portuguese", rus: "Russian", kor: "Korean", hin: "Hindi",
        ara: "Arabic", vie: "Vietnamese", ron: "Romanian", yor: "Yoruba",
      };
      const cache: Record<string, any> = {};
      const get = async (lang: string) =>
        cache[lang] ??= await pipeline("text-to-speech", `Xenova/mms-tts-${lang}`,
          { dtype: "q8", device: "wasm", progress_callback: onProgress });
      await get("eng");
      return {
        voices: Object.entries(langs).map(([id, label]) => ({ id, label })),
        async generate(text, lang) {
          const out = await (await get(lang))(text);
          return { samples: out.audio, rate: out.sampling_rate };
        },
      };
    },
  },
  kitten: {
    name: "KittenTTS Nano",
    detail: "Smallest · 8 voices · ~24 MB",
    links: [
      { label: "Model card", url: "https://huggingface.co/KittenML/kitten-tts-nano-0.8" },
      { label: "KittenTTS", url: "https://github.com/KittenML/KittenTTS" },
      { label: "kitten-tts-js", url: "https://github.com/Algiras/kitten-tts-js" },
    ],
    async load() {
      // kitten-tts-js is loaded as plain source (not a CDN bundle): bundlers'
      // Node polyfills define process.versions.node, which tricks its
      // environment detection into the fs-based code path. The import map in
      // index.html supplies its bare dependency specifiers.
      // ORT resolves its .wasm/.mjs helpers relative to the importing module,
      // which breaks cross-CDN, so pin wasmPaths first.
      const ort = await import(/* @vite-ignore */ `${ORT_DIST}ort.min.mjs`);
      ort.env.wasm.wasmPaths = ORT_DIST;
      const { KittenTTS } = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/kitten-tts-js@0.1.2/src/index.browser.js"
      );
      const tts = await KittenTTS.from_pretrained("KittenML/kitten-tts-nano-0.8");
      return {
        voices: tts.list_voices().map((name: string) => ({ id: name, label: name })),
        async generate(text, voice) {
          const audio = await tts.generate(text, { voice });
          return { samples: audio.data, rate: audio.sampling_rate };
        },
      };
    },
  },
};

export function toWavBlob(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVEfmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([buf], { type: "audio/wav" });
}
