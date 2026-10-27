"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { ArrowLeft, CheckCircle2, Maximize, Settings, TriangleAlert, Volume2, VolumeX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { attendanceKioskApi, toJpegDataUrl, type KioskScanResponse } from "@/lib/resources/attendance";
import { errorMessage } from "./shared";

/**
 * Pointeuse plein écran (compte kiosque, AttendanceKiosk.create).
 * La caméra du PC lit le QR de la carte (BarcodeDetector si le navigateur
 * le propose, sinon jsQR) ; une douchette USB (qui « tape » le code puis
 * Entrée) fonctionne aussi. Le serveur choisit l'action (séquence
 * automatique) et renvoie l'écran de confirmation. Une petite photo webcam
 * accompagne chaque pointage (contrôle anti-fraude).
 */

interface DetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

type Shown = KioskScanResponse | { result: "ERROR"; message: string; info: string[]; tone: "danger" };

const STORE_KEY = "pointeuse.settings";
const SCAN_EVERY_MS = 140;
/** Une même carte n'est relue qu'après avoir quitté le champ de la caméra pendant ce délai. */
const SAME_CODE_GONE_MS = 2500;
const RESULT_MS = 4500;
const HEARTBEAT_MS = 5 * 60_000;

interface KioskSettings {
  station: string;
  deviceId: string;
  sound: boolean;
}

function readSettings(): KioskSettings {
  const def = { station: "", deviceId: "", sound: true };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? { ...def, ...JSON.parse(raw) } : def;
  } catch {
    return def;
  }
}

function writeSettings(s: KioskSettings) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : réglages pour cette session seulement */
  }
}

let audioCtx: AudioContext | null = null;
function beep(tone: "success" | "warning" | "danger") {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const notes = tone === "success" ? [880, 1320] : tone === "warning" ? [660, 660] : [300, 220];
    notes.forEach((f, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.value = 0.15;
      o.connect(g).connect(audioCtx!.destination);
      const t = audioCtx!.currentTime + i * 0.15;
      o.start(t);
      o.stop(t + 0.12);
    });
  } catch {
    /* pas de son */
  }
}

export function KioskScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<DetectorLike | null>(null);
  const busyRef = useRef(false);
  const pausedUntil = useRef(0);
  const lastCode = useRef<{ code: string; seen: number }>({ code: "", seen: 0 });
  const offsetRef = useRef(0);
  const settingsRef = useRef<KioskSettings>({ station: "", deviceId: "", sound: true });

  const [settings, setSettings] = useState<KioskSettings>({ station: "", deviceId: "", sound: true });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [kioskName, setKioskName] = useState("");
  const [online, setOnline] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const s = readSettings();
    settingsRef.current = s;
    setSettings(s);
  }, []);

  // Horloge (calée sur l'heure du serveur) + battement de cœur (garde la session ouverte).
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date(Date.now() + offsetRef.current)), 1000);
    const ping = () =>
      attendanceKioskApi
        .status()
        .then((s) => {
          offsetRef.current = new Date(s.serverTime).getTime() - Date.now();
          setKioskName(s.kiosk);
          setOnline(true);
        })
        .catch(() => setOnline(false));
    ping();
    const hb = setInterval(ping, HEARTBEAT_MS);
    return () => {
      clearInterval(tick);
      clearInterval(hb);
    };
  }, []);

  // Écran toujours allumé (si le navigateur le permet).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const req = () =>
      nav.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => undefined);
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => undefined);
    };
  }, []);

  const handleCode = useCallback(async (raw: string, fromCamera = true) => {
    const code = raw.trim();
    const t = Date.now();
    if (!code) return;
    if (fromCamera) {
      // Carte laissée devant la caméra : on ne la relit pas en boucle.
      const same = lastCode.current.code === code && t - lastCode.current.seen < SAME_CODE_GONE_MS;
      lastCode.current = { code, seen: t };
      if (same) return;
    }
    if (busyRef.current || t < pausedUntil.current) return;
    busyRef.current = true;
    setBusy(true);
    let photo: string | undefined;
    const v = videoRef.current;
    if (v && v.videoWidth) {
      try {
        photo = toJpegDataUrl(v, v.videoWidth, v.videoHeight, 320, 240, 55_000);
      } catch {
        photo = undefined;
      }
    }
    let res: Shown;
    try {
      res = await attendanceKioskApi.scan({ code, photo, station: settingsRef.current.station || undefined });
      setOnline(true);
    } catch (err) {
      res = { result: "ERROR", message: "Pointage non enregistré", info: [errorMessage(err), "Réessayez dans un instant."], tone: "danger" };
      if (fromCamera) lastCode.current = { code: "", seen: 0 };
    }
    if (settingsRef.current.sound) beep(res.tone);
    setShown(res);
    pausedUntil.current = Date.now() + RESULT_MS - 800;
    busyRef.current = false;
    setBusy(false);
    setTimeout(() => setShown((cur) => (cur === res ? null : cur)), RESULT_MS);
  }, []);

  // Caméra + boucle de lecture du QR.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let detecting = false;
    setCameraError(null);
    setCameraOn(false);

    const W = window as Window & { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike };
    detectorRef.current = null;
    if (W.BarcodeDetector) {
      try {
        detectorRef.current = new W.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        detectorRef.current = null;
      }
    }

    async function loop() {
      if (stopped) return;
      const v = videoRef.current;
      // On lit aussi pendant l'affichage du résultat, pour savoir si la carte est toujours devant la caméra.
      if (v && v.readyState >= 2 && v.videoWidth && !detecting && !busyRef.current) {
        detecting = true;
        try {
          const scale = Math.min(1, 640 / v.videoWidth);
          const w = Math.round(v.videoWidth * scale);
          const h = Math.round(v.videoHeight * scale);
          const canvas = (canvasRef.current = canvasRef.current ?? document.createElement("canvas"));
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, w, h);
            let value: string | null = null;
            if (detectorRef.current) {
              try {
                value = (await detectorRef.current.detect(canvas))[0]?.rawValue ?? null;
              } catch {
                detectorRef.current = null; // repli sur jsQR
              }
            }
            if (!detectorRef.current && value === null) {
              const img = ctx.getImageData(0, 0, w, h);
              value = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
            if (value) void handleCode(value);
          }
        } finally {
          detecting = false;
        }
      }
      timer = setTimeout(loop, SCAN_EVERY_MS);
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Caméra indisponible : ouvrez la pointeuse en HTTPS (ou sur localhost) dans Chrome ou Edge.");
      return;
    }
    const video: MediaTrackConstraints = settings.deviceId
      ? { deviceId: { exact: settings.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        setCameraOn(true);
        navigator.mediaDevices
          .enumerateDevices()
          .then((d) => setDevices(d.filter((x) => x.kind === "videoinput")))
          .catch(() => undefined);
        loop();
      })
      .catch(() => setCameraError("Accès à la caméra refusé ou caméra introuvable. Autorisez la caméra pour ce site puis rechargez la page."));
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [settings.deviceId, handleCode]);

  // Douchette USB / saisie clavier rapide terminée par Entrée.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const t = Date.now();
      if (t - last > 120) buffer = "";
      last = t;
      if (e.key === "Enter") {
        if (buffer.length >= 16) void handleCode(buffer, false);
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCode]);

  function saveSettings(s: KioskSettings) {
    settingsRef.current = s;
    setSettings(s);
    writeSettings(s);
  }

  const time = now ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
  const date = now ? now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0f2a16] text-white">
      <header className="flex items-center justify-between gap-4 bg-[#174E26] px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/pointage" className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Quitter la pointeuse">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="text-lg font-bold tracking-wide">POINTEUSE</div>
            <div className="text-xs text-white/70">{settings.station || kioskName || "Poste de pointage"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${online ? "bg-[#8DBE48]/20 text-[#cfe8a8]" : "bg-red-500/30 text-red-100"}`}>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-[#8DBE48]" : "bg-red-400"}`} />
            {online ? "Connecté" : "Serveur injoignable"}
          </span>
          <button className="rounded-md p-2 text-white/70 hover:bg-white/10" title={settings.sound ? "Couper le son" : "Activer le son"} onClick={() => saveSettings({ ...settings, sound: !settings.sound })}>
            {settings.sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button
            className="rounded-md p-2 text-white/70 hover:bg-white/10"
            title="Plein écran"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
          >
            <Maximize className="h-5 w-5" />
          </button>
          <button className="rounded-md p-2 text-white/70 hover:bg-white/10" title="Réglages du poste" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 items-center gap-8 p-6 lg:grid-cols-[1fr_1.3fr] lg:p-10">
        <section className="text-center lg:text-left">
          <div className="font-mono text-6xl font-bold tabular-nums lg:text-8xl">{time}</div>
          <div className="mt-2 text-xl capitalize text-white/80">{date}</div>
          <div className="mt-10 space-y-3 text-lg text-white/90">
            <p className="text-2xl font-semibold text-[#F0A020]">Présentez votre carte devant la caméra</p>
            <p>Tenez la carte immobile, QR code face à l&apos;écran, à 20–30 cm.</p>
            <p className="text-base text-white/60">Entrée, pause, retour ou sortie : l&apos;action est choisie automatiquement.</p>
          </div>
        </section>

        <section className="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border-4 border-[#8DBE48]/60 bg-black shadow-2xl">
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {cameraOn && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`relative h-1/2 aspect-square rounded-xl border-4 ${busy ? "border-[#F0A020]" : "border-[#8DBE48]"} shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]`}>
                <div className="absolute inset-x-2 top-1/2 h-0.5 animate-pulse bg-[#8DBE48]" />
              </div>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-lg text-red-100">
              <div>
                <TriangleAlert className="mx-auto mb-3 h-10 w-10 text-[#F0A020]" />
                {cameraError}
              </div>
            </div>
          )}
          {!cameraOn && !cameraError && <div className="absolute inset-0 flex items-center justify-center text-white/60">Démarrage de la caméra…</div>}
        </section>
      </main>

      {shown && <ResultOverlay shown={shown} />}

      <KioskSettingsModal
        open={showSettings}
        settings={settings}
        devices={devices}
        onClose={() => setShowSettings(false)}
        onSave={(s) => {
          saveSettings(s);
          setShowSettings(false);
        }}
      />
    </div>
  );
}

function ResultOverlay({ shown }: { shown: Shown }) {
  const bg = shown.tone === "success" ? "bg-[#174E26]" : shown.tone === "warning" ? "bg-[#9a6200]" : "bg-red-800";
  const Icon = shown.tone === "success" ? CheckCircle2 : shown.tone === "warning" ? TriangleAlert : XCircle;
  const emp = "employee" in shown ? shown.employee : undefined;
  const punch = "punch" in shown ? shown.punch : undefined;
  return (
    <div className={`fixed inset-0 z-40 flex items-center justify-center ${bg} p-8`}>
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center lg:flex-row lg:text-left">
        {emp ? (
          <div className="h-72 w-56 shrink-0 overflow-hidden rounded-2xl border-4 border-white/80 bg-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {emp.photo ? <img src={emp.photo} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-6xl font-bold">
                {emp.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </div>}
          </div>
        ) : (
          <Icon className="h-40 w-40 shrink-0 text-white/90" />
        )}
        <div className="min-w-0">
          {emp && (
            <>
              <div className="text-4xl font-bold lg:text-5xl">{emp.fullName}</div>
              <div className="mt-1 text-xl text-white/80">
                {emp.matricule} · {emp.groupName}
              </div>
            </>
          )}
          <div className="mt-6 flex items-center justify-center gap-4 lg:justify-start">
            <Icon className="h-14 w-14" />
            <span className="text-5xl font-extrabold uppercase tracking-wide lg:text-6xl">{shown.message}</span>
          </div>
          {punch && (
            <div className={`mt-3 text-3xl font-semibold tabular-nums ${shown.tone === "success" ? "text-[#F0A020]" : "text-white"}`}>
              {new Date(punch.punchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <ul className="mt-5 space-y-1 text-2xl text-white/90">
            {shown.info.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KioskSettingsModal({
  open,
  settings,
  devices,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: KioskSettings;
  devices: MediaDeviceInfo[];
  onClose: () => void;
  onSave: (s: KioskSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Réglages de ce poste"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onSave({ ...draft, station: draft.station.trim() })}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4 text-slate-900">
        <Input
          label="Nom du poste"
          placeholder="Ex. Portail usine"
          hint="Enregistré avec chaque pointage. Gardé dans ce navigateur."
          value={draft.station}
          maxLength={80}
          onChange={(e) => setDraft((d) => ({ ...d, station: e.target.value }))}
        />
        <Select label="Caméra" value={draft.deviceId} onChange={(e) => setDraft((d) => ({ ...d, deviceId: e.target.value }))}>
          <option value="">Caméra par défaut</option>
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `Caméra ${i + 1}`}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-500">
          Astuce : lancez Chrome ou Edge en mode kiosque sur /pointeuse avec le compte « Pointeuse ». Une douchette USB peut remplacer la caméra.
        </p>
      </div>
    </Modal>
  );
}
