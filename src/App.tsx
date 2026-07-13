import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { alpha } from "@mui/material/styles";
import { MODELS, toWavBlob, webgpu, type Engine } from "./models";

const ACCENT = "#1E56C7";

const DEFAULT_TEXT =
  "Hello! This is a proof of concept running an open source text to speech model entirely inside the browser.";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Logo() {
  const bars = [10, 18, 26, 16, 9];
  return (
    <Stack direction="row" spacing={0.375} sx={{ height: 26, alignItems: "flex-end" }}>
      {bars.map((h, i) => (
        <Box
          key={i}
          sx={{
            width: 3.5,
            height: h,
            borderRadius: "2px",
            bgcolor: "primary.main",
            opacity: h === 26 ? 1 : h >= 16 ? 0.7 : 0.45,
          }}
        />
      ))}
    </Stack>
  );
}

interface OutlinedFieldProps {
  label: string;
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
  endAdornment?: ReactNode;
}

function OutlinedField({ label, value, onClick, disabled, accent, endAdornment }: OutlinedFieldProps) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        position: "relative",
        border: "solid",
        borderWidth: accent ? 2 : 1,
        borderColor: accent
          ? "primary.main"
          : (t) => alpha(t.palette.text.primary, 0.23),
        borderRadius: 1,
        px: 1.875,
        py: 1.6,
        cursor: onClick && !disabled ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Typography
        component="span"
        sx={{
          position: "absolute",
          top: -9,
          left: 11,
          px: 0.6,
          fontSize: 12,
          fontWeight: accent ? 500 : 400,
          lineHeight: 1,
          bgcolor: "background.paper",
          color: accent ? "primary.main" : "text.secondary",
        }}
      >
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography
          noWrap
          sx={{
            fontSize: 16,
            color: accent ? "primary.main" : "text.primary",
            fontWeight: accent ? 500 : 400,
          }}
        >
          {value}
        </Typography>
        {endAdornment}
      </Stack>
    </Box>
  );
}

function Chevron({ color = "text.secondary" }: { color?: string }) {
  return (
    <Box
      sx={{
        width: 0,
        height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: "6px solid",
        borderTopColor: color,
      }}
    />
  );
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    audioRef.current?.play().catch(() => {});
  }, [src]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = "speech.wav";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <Stack
      direction="row"
      spacing={1.75}
      sx={{
        alignItems: "center",
        bgcolor: (t) => (t.palette.mode === "dark" ? alpha(t.palette.common.white, 0.04) : "#F7F8FA"),
        border: "1px solid",
        borderColor: (t) => alpha(t.palette.text.primary, 0.08),
        borderRadius: 1.25,
        px: 1.75,
        py: 1.5,
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        style={{ display: "none" }}
      />
      <IconButton
        onClick={() => (playing ? audioRef.current?.pause() : audioRef.current?.play())}
        sx={{
          flexShrink: 0,
          width: 42,
          height: 42,
          bgcolor: "primary.main",
          boxShadow: (t) => `0 2px 6px -1px ${alpha(t.palette.primary.main, 0.55)}`,
          "&:hover": { bgcolor: "primary.main", filter: "brightness(0.93)" },
        }}
      >
        {playing ? (
          <Stack direction="row" spacing={0.5}>
            <Box sx={{ width: 4, height: 15, bgcolor: "primary.contrastText", borderRadius: "1px" }} />
            <Box sx={{ width: 4, height: 15, bgcolor: "primary.contrastText", borderRadius: "1px" }} />
          </Stack>
        ) : (
          <Box
            sx={{
              width: 0,
              height: 0,
              borderLeft: "13px solid",
              borderLeftColor: "primary.contrastText",
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              ml: "3px",
            }}
          />
        )}
      </IconButton>

      <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.875}>
        <Box
          onClick={seek}
          sx={{
            position: "relative",
            height: 4,
            borderRadius: "3px",
            bgcolor: (t) => alpha(t.palette.text.primary, 0.1),
            cursor: "pointer",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progress}%`,
              borderRadius: "3px",
              bgcolor: "primary.main",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: `${progress}%`,
              top: "50%",
              width: 11,
              height: 11,
              borderRadius: "50%",
              bgcolor: "primary.main",
              transform: "translate(-50%,-50%)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          />
        </Box>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 12, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
            {formatTime(currentTime)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
            {formatTime(duration)}
          </Typography>
        </Stack>
      </Stack>

      <IconButton
        title="Download WAV"
        onClick={download}
        sx={{ flexShrink: 0, width: 38, height: 38, color: "text.secondary" }}
      >
        <Stack spacing={0.125} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "6px solid currentColor",
            }}
          />
          <Box sx={{ width: 14, height: 2, bgcolor: "currentColor", borderRadius: "1px" }} />
        </Stack>
      </IconButton>
    </Stack>
  );
}

interface StatusMessage {
  severity: "success" | "error";
  message: string;
}

export default function App() {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDark ? "dark" : "light",
          primary: { main: ACCENT },
          ...(prefersDark ? {} : { background: { default: "#F4F5F7" } }),
        },
        shape: { borderRadius: 8 },
      }),
    [prefersDark],
  );

  const enginesRef = useRef<Record<string, Engine>>({});
  const [modelId, setModelId] = useState("kokoro");
  const [engine, setEngine] = useState<Engine | null>(null);
  const [voice, setVoice] = useState("");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // 0..100, or null = indeterminate
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const busy = loading || generating;
  const sizeLabel = MODELS[modelId].detail.split(" · ").reverse().find((s) => s.startsWith("~"));

  const selectModel = (id: string) => {
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
        if (p.status === "progress" && p.total) setProgress((p.loaded! / p.total) * 100);
      });
      enginesRef.current[modelId] = loaded;
      setEngine(loaded);
      setVoice(loaded.voices[0].id);
    } catch (err) {
      setStatus({ severity: "error", message: `Error loading model: ${errorMessage(err)}` });
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
      setAudioUrl(URL.createObjectURL(out.blob ?? toWavBlob(out.samples!, out.rate!)));
      setStatus({
        severity: "success",
        message: `Done in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
      });
    } catch (err) {
      setStatus({ severity: "error", message: `Error: ${errorMessage(err)}` });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", display: "flex", justifyContent: "center", pt: 9, px: 3, pb: 6 }}>
        <Box sx={{ width: "100%", maxWidth: 468 }}>
          <Stack spacing={3.25}>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1.375} sx={{ alignItems: "flex-end" }}>
                <Logo />
                <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  speech
                  <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
                    .website
                  </Box>
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 14.5, color: "text.secondary", lineHeight: 1.5, maxWidth: 400 }}>
                Text to speech that runs entirely in your browser.
              </Typography>
            </Stack>

            <Card
              variant="outlined"
              sx={{
                borderRadius: "14px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04),0 8px 24px -12px rgba(16,24,40,0.14)",
              }}
            >
              <Stack spacing={2.75} sx={{ p: 3.25 }}>
                <OutlinedField
                  label="Model"
                  value={MODELS[modelId].name}
                  accent
                  disabled={busy}
                  onClick={() => setPickerOpen(true)}
                  endAdornment={<Chevron color="primary.main" />}
                />

                {!engine && !loading && (
                  <Button variant="contained" fullWidth onClick={loadModel} sx={{ py: 1.375 }}>
                    Load model
                  </Button>
                )}

                {loading && (
                  <Stack spacing={1.125}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: "text.secondary" }}>
                        Downloading model weights…
                      </Typography>
                      {sizeLabel && (
                        <Typography sx={{ fontSize: 12.5, color: "text.disabled" }}>{sizeLabel}</Typography>
                      )}
                    </Stack>
                    <LinearProgress
                      variant={progress === null ? "indeterminate" : "determinate"}
                      value={progress ?? 0}
                      sx={{ height: 4, borderRadius: "3px" }}
                    />
                  </Stack>
                )}

                {engine && !loading && (
                  <Stack
                    direction="row"
                    spacing={1.125}
                    sx={{
                      alignItems: "center",
                      px: 1.75,
                      py: 1.25,
                      border: "1px solid",
                      borderColor: alpha(theme.palette.success.main, 0.4),
                      bgcolor: alpha(theme.palette.success.main, 0.07),
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        bgcolor: "success.main",
                        color: "success.contrastText",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        lineHeight: 1,
                      }}
                    >
                      ✓
                    </Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: prefersDark ? "success.light" : "#1B5E20" }}>
                      Model ready · cached for next time
                    </Typography>
                  </Stack>
                )}

                <Divider sx={{ mx: -0.25 }} />

                <TextField
                  label="Text to speak"
                  multiline
                  minRows={4}
                  value={text}
                  disabled={!engine}
                  onChange={(e) => setText(e.target.value)}
                  fullWidth
                />

                <Stack direction="row" spacing={1.5} sx={{ alignItems: "stretch" }}>
                  <FormControl sx={{ flex: 1, minWidth: 0 }} disabled={!engine}>
                    <InputLabel id="voice-label">Voice</InputLabel>
                    <Select
                      labelId="voice-label"
                      label="Voice"
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                    >
                      {(engine?.voices ?? []).map((v) => (
                        <MenuItem key={v.id} value={v.id}>
                          {v.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    onClick={generate}
                    disabled={!engine || !text.trim()}
                    loading={generating}
                    sx={{ flexShrink: 0, px: 2.5 }}
                  >
                    Generate
                  </Button>
                </Stack>

                {status && <Alert severity={status.severity}>{status.message}</Alert>}

                {audioUrl && <AudioPlayer src={audioUrl} />}
              </Stack>
            </Card>

            <Stack direction="row" sx={{ justifyContent: "center" }}>
              <Link
                component="button"
                onClick={() => setAboutOpen(true)}
                sx={{
                  fontSize: 12.5,
                  color: "text.disabled",
                  cursor: "pointer",
                  background: "none",
                  border: 0,
                  p: 0,
                  font: "inherit",
                }}
              >
                About
              </Link>
            </Stack>
          </Stack>
        </Box>
      </Box>

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
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
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
    </ThemeProvider>
  );
}
