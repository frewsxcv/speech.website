import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  Link,
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
          <IconButton
            aria-label="About"
            size="small"
            onClick={() => setAboutOpen(true)}
            sx={{ position: "fixed", top: 12, right: 12, fontSize: "1.1rem", width: 32, height: 32 }}
          >
            ⓘ
          </IconButton>

          <Button
            variant="outlined"
            fullWidth
            disabled={busy}
            onClick={() => setPickerOpen(true)}
            sx={{ justifyContent: "space-between", textTransform: "none", py: 1.25, px: 2 }}
          >
            <Box sx={{ textAlign: "left" }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Model
              </Typography>
              <Typography>{MODELS[modelId].name}</Typography>
            </Box>
            <Typography color="text.secondary">▾</Typography>
          </Button>

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

        <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Choose a model</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              {Object.entries(MODELS).map(([id, m]) => (
                <Card
                  key={id}
                  variant="outlined"
                  sx={id === modelId ? { borderColor: "primary.main", borderWidth: 2 } : undefined}
                >
                  <CardActionArea onClick={() => { selectModel(id); setPickerOpen(false); }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1">{m.name}</Typography>
                        {id === modelId && <Chip label="Selected" size="small" color="primary" />}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {m.detail}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                  <CardActions sx={{ px: 2, pt: 0, flexWrap: "wrap", gap: 1.5 }}>
                    {m.links.map((l) => (
                      <Link key={l.url} href={l.url} target="_blank" rel="noopener" variant="body2">
                        {l.label} ↗
                      </Link>
                    ))}
                  </CardActions>
                </Card>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPickerOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>🗣️ speech.website</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Open text-to-speech models running entirely in this tab via{" "}
                <Link href="https://onnxruntime.ai/docs/tutorials/web/" target="_blank" rel="noopener">
                  ONNX Runtime Web
                </Link>
                . Weights download once, then cache. No server — your text never
                leaves this device. Backend in use:{" "}
                <Chip
                  label={webgpu ? "WebGPU" : "WASM"}
                  size="small"
                  color={webgpu ? "success" : "default"}
                  variant="outlined"
                  component="span"
                />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Details and reference links for each model live in the model picker.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <Link href="https://github.com/frewsxcv/speech.website" target="_blank" rel="noopener">
                  Source on GitHub ↗
                </Link>
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAboutOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}
