import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  FormControl,
  InputLabel,
  LinearProgress,
  Link,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
  useMediaQuery,
} from "@mui/material";
import { MODELS, toWavBlob, webgpu } from "./models.js";

const DEFAULT_TEXT =
  "Hello! This is a proof of concept running an open source text to speech model entirely inside the browser.";

export default function App() {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(
    () => createTheme({ palette: { mode: prefersDark ? "dark" : "light" } }),
    [prefersDark],
  );

  const enginesRef = useRef({});
  const [modelId, setModelId] = useState("kokoro");
  const [engine, setEngine] = useState(null);
  const [voice, setVoice] = useState("");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null); // 0..100, or null = indeterminate
  const [status, setStatus] = useState(null); // { severity, message }
  const [audioUrl, setAudioUrl] = useState(null);

  const busy = loading || generating;

  const selectModel = (id) => {
    setModelId(id);
    const cached = enginesRef.current[id] ?? null;
    setEngine(cached);
    setVoice(cached ? cached.voices[0].id : "");
    setStatus(null);
  };

  const loadModel = async () => {
    setLoading(true);
    setProgress(null);
    setStatus(null);
    try {
      const loaded = await MODELS[modelId].load((p) => {
        if (p.status === "progress" && p.total) setProgress((p.loaded / p.total) * 100);
      });
      enginesRef.current[modelId] = loaded;
      setEngine(loaded);
      setVoice(loaded.voices[0].id);
    } catch (err) {
      setStatus({ severity: "error", message: `Error loading model: ${err.message}` });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const generate = async () => {
    if (!engine || !text.trim()) return;
    setGenerating(true);
    setStatus(null);
    const t0 = performance.now();
    try {
      const out = await engine.generate(text.trim(), voice);
      setAudioUrl(URL.createObjectURL(out.blob ?? toWavBlob(out.samples, out.rate)));
      setStatus({
        severity: "success",
        message: `Done in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
      });
    } catch (err) {
      setStatus({ severity: "error", message: `Error: ${err.message}` });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              🗣️ speech.website
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Open text-to-speech models running entirely in this tab via{" "}
              <Link href="https://onnxruntime.ai/docs/tutorials/web/">ONNX Runtime Web</Link>.
              Weights download once, then cache. No server.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl fullWidth size="small">
              <InputLabel id="model-label">Model</InputLabel>
              <Select
                labelId="model-label"
                label="Model"
                value={modelId}
                disabled={busy}
                onChange={(e) => selectModel(e.target.value)}
                renderValue={(id) => MODELS[id].name}
              >
                {Object.entries(MODELS).map(([id, m]) => (
                  <MenuItem key={id} value={id}>
                    <ListItemText primary={m.name} secondary={m.detail} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip
              label={webgpu ? "WebGPU" : "WASM"}
              size="small"
              color={webgpu ? "success" : "default"}
              variant="outlined"
            />
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mt: -2 }}>
            <Typography variant="body2" color="text.secondary">
              {MODELS[modelId].detail}
            </Typography>
            {MODELS[modelId].links.map((l) => (
              <Link key={l.url} href={l.url} target="_blank" rel="noopener" variant="body2">
                {l.label} ↗
              </Link>
            ))}
          </Stack>

          {!engine && (
            <Button variant="contained" onClick={loadModel} loading={loading}>
              Load model
            </Button>
          )}
          {loading && (
            <LinearProgress
              variant={progress === null ? "indeterminate" : "determinate"}
              value={progress ?? 0}
            />
          )}

          <TextField
            label="Text to speak"
            multiline
            minRows={4}
            value={text}
            disabled={!engine}
            onChange={(e) => setText(e.target.value)}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl sx={{ minWidth: 220 }} size="small" disabled={!engine}>
              <InputLabel id="voice-label">Voice</InputLabel>
              <Select
                labelId="voice-label"
                label="Voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
              >
                {(engine?.voices ?? []).map((v) => (
                  <MenuItem key={v.id} value={v.id}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={generate}
              disabled={!engine || !text.trim()}
              loading={generating}
            >
              Generate speech
            </Button>
          </Stack>

          {status && <Alert severity={status.severity}>{status.message}</Alert>}

          {audioUrl && (
            <audio src={audioUrl} controls autoPlay style={{ width: "100%" }} />
          )}
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
