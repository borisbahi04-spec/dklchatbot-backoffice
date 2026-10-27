"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cropPortrait, toJpegDataUrl } from "@/lib/resources/attendance";

/**
 * Prise de photo à la webcam pour la fiche employé (portrait 4:5,
 * JPEG compressé sous ~85 Ko). Renvoie une data URL.
 */
export function CameraCapture({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);
    setReady(false);
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => undefined);
        }
      })
      .catch(() => setError("Caméra indisponible ou accès refusé par le navigateur."));
    if (!navigator.mediaDevices) setError("Caméra non disponible (le site doit être ouvert en HTTPS ou sur localhost).");
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const portrait = cropPortrait(v, v.videoWidth, v.videoHeight);
    onCapture(toJpegDataUrl(portrait, portrait.width, portrait.height, 360, 450, 85_000));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Prendre la photo"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={capture} disabled={!ready}>
            <Camera className="h-4 w-4" /> Capturer
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="relative mx-auto aspect-[4/5] w-64 overflow-hidden rounded-lg bg-slate-900">
          <video ref={videoRef} playsInline muted onLoadedMetadata={() => setReady(true)} className="h-full w-full -scale-x-100 object-cover" />
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-500">Visage centré, de face, sur fond clair.</p>
    </Modal>
  );
}
