import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  Camera, X, Loader2, CheckCircle2, AlertCircle, RefreshCw,
  Sparkles, Users, UserCheck, ShieldCheck, Volume2, VolumeX, Eye
} from 'lucide-react';

interface FaceScannerProps {
  isOpen: boolean;
  onClose: () => void;
  members: Array<{
    id: string;
    name: string;
    photoUrl?: string;
    phone?: string;
  }>;
  presentIds: Set<string>;
  onMarkPresent: (memberId: string) => void;
}

interface LabeledDescriptor {
  id: string;
  name: string;
  descriptor: Float32Array;
}

export default function FaceAttendanceScannerModal({
  isOpen,
  onClose,
  members,
  presentIds,
  onMarkPresent,
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [modelLoaded, setModelLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Memulai AI...');
  const [enrolledCount, setEnrolledCount] = useState<number>(0);
  const [totalPhotosCount, setTotalPhotosCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recentScans, setRecentScans] = useState<Array<{
    id: string;
    name: string;
    time: string;
    confidence: number;
    alreadyPresent: boolean;
  }>>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const enrolledMembersRef = useRef<LabeledDescriptor[]>([]);
  const isDetectingRef = useRef(false);
  const lastCheckinTimesRef = useRef<Map<string, number>>(new Map()); // Debounce check-in per member

  // Play audio chime on detection
  const playChime = useCallback((success = true) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // AudioContext maybe blocked by browser autoplay policy until user gesture
    }
  }, [soundEnabled]);

  // 1. Load Face-API models
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadModels() {
      try {
        setLoadingStatus('Memuat model deteksi wajah AI...');
        const MODEL_URL = '/models';

        // Load Tiny Face Detector, Landmark Tiny, and Face Recognition models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (isMounted) {
          setModelLoaded(true);
          setLoadingStatus('Model AI siap! Menyiapkan data wajah jemaat...');
        }
      } catch (err: any) {
        console.error('Failed to load faceapi models:', err);
        if (isMounted) {
          setLoadingStatus(`Gagal memuat AI: ${err.message || 'Periksa koneksi model'}`);
        }
      }
    }

    loadModels();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 2. Pre-extract face descriptors from members with photos
  useEffect(() => {
    if (!isOpen || !modelLoaded) return;

    let isMounted = true;
    async function enrollMemberFaces() {
      const membersWithPhoto = members.filter(m => m.photoUrl && m.photoUrl.startsWith('http'));
      setTotalPhotosCount(membersWithPhoto.length);

      if (membersWithPhoto.length === 0) {
        setLoadingStatus('Belum ada foto jemaat terdaftar. Anda bisa tetap membuka kamera.');
        return;
      }

      setLoadingStatus(`Menganalisis foto ${membersWithPhoto.length} jemaat...`);
      const descriptors: faceapi.LabeledFaceDescriptors[] = [];
      let enrolled = 0;

      // Extract in batches or sequential to avoid overwhelming memory
      for (const m of membersWithPhoto) {
        if (!isMounted) return;
        try {
          const img = await faceapi.fetchImage(m.photoUrl!);
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (detection && detection.descriptor) {
            descriptors.push(new faceapi.LabeledFaceDescriptors(m.id, [detection.descriptor]));
            enrolled++;
            if (isMounted) {
              setEnrolledCount(enrolled);
            }
          }
        } catch {
          // Ignore individual photo fetch / CORS error silently
        }
      }

      if (isMounted) {
        if (descriptors.length > 0) {
          // Threshold 0.55 means distance <= 0.55 is match (~80%+ similarity)
          faceMatcherRef.current = new faceapi.FaceMatcher(descriptors, 0.55);
          setLoadingStatus(`Siap! ${descriptors.length} jemaat terdaftar dalam sistem AI.`);
        } else {
          setLoadingStatus('Foto jemaat belum dapat dikenali atau terhalang CORS. Siap memindai.');
        }
      }
    }

    enrollMemberFaces();
    return () => {
      isMounted = false;
    };
  }, [isOpen, modelLoaded, members]);

  // 3. Start Camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      // Request webcam with ideal resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user', // Front camera on mobile / laptop
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      alert(`Gagal mengakses kamera: ${err.message || 'Izinkan akses kamera di browser Anda.'}`);
    }
  }, []);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    isDetectingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // When modal is open & models loaded, start camera
  useEffect(() => {
    if (isOpen && modelLoaded) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, modelLoaded, startCamera, stopCamera]);

  // 4. Real-time Detection Loop
  useEffect(() => {
    if (!isOpen || !cameraActive || !videoRef.current) return;

    let animationFrameId: number;
    isDetectingRef.current = true;

    async function detectFaces() {
      if (!isDetectingRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === 4 && canvas) {
        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, displaySize);

        try {
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptors();

          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

          // If we have enrolled faces and faceMatcher
          if (faceMatcherRef.current && resizedDetections.length > 0) {
            for (const detection of resizedDetections) {
              const bestMatch = faceMatcherRef.current.findBestMatch(detection.descriptor);
              const box = detection.detection.box;
              const isUnknown = bestMatch.label === 'unknown';
              const memberId = bestMatch.label;
              const matchedMember = members.find(m => m.id === memberId);
              const confidence = Math.round((1 - bestMatch.distance) * 100);

              // Draw bounding box
              if (ctx) {
                ctx.lineWidth = 3;
                ctx.strokeStyle = isUnknown ? '#e11d48' : '#10b981'; // red for unknown, emerald for recognized
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                // Label background
                const labelText = isUnknown ? 'Wajah Belum Terdaftar' : `${matchedMember?.name || 'Jemaat'} (${confidence}%)`;
                ctx.font = 'bold 14px sans-serif';
                const textWidth = ctx.measureText(labelText).width;
                ctx.fillStyle = isUnknown ? 'rgba(225, 29, 72, 0.85)' : 'rgba(16, 185, 129, 0.9)';
                ctx.fillRect(box.x, Math.max(0, box.y - 26), textWidth + 14, 24);

                // Label text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, box.x + 7, Math.max(16, box.y - 9));
              }

              // Auto-checkin trigger if recognized with good confidence (>= 60%)
              if (!isUnknown && matchedMember && confidence >= 60) {
                const now = Date.now();
                const lastCheckin = lastCheckinTimesRef.current.get(memberId) || 0;

                // Debounce checkin to avoid repeated calls within 15 seconds
                if (now - lastCheckin > 15000) {
                  lastCheckinTimesRef.current.set(memberId, now);
                  const isAlreadyPresent = presentIds.has(memberId);

                  if (!isAlreadyPresent) {
                    onMarkPresent(memberId);
                    playChime(true);
                  }

                  // Record in recent scans feed
                  setRecentScans(prev => [
                    {
                      id: memberId,
                      name: matchedMember.name,
                      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                      confidence,
                      alreadyPresent: isAlreadyPresent,
                    },
                    ...prev.slice(0, 19),
                  ]);
                }
              }
            }
          } else if (resizedDetections.length > 0 && ctx) {
            // No face matcher enrolled yet, just draw face detection frame
            for (const d of resizedDetections) {
              const box = d.detection.box;
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#3b82f6';
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            }
          }
        } catch {
          // Ignore transient detection errors
        }
      }

      // Run next detection frame
      if (isDetectingRef.current) {
        animationFrameId = requestAnimationFrame(detectFaces);
      }
    }

    animationFrameId = requestAnimationFrame(detectFaces);
    return () => {
      isDetectingRef.current = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, cameraActive, members, presentIds, onMarkPresent, playChime]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <Camera size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI Face Recognition Absensi</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-emerald-950 flex items-center gap-1 shadow-2xs">
                  <Sparkles size={10} /> Real-Time
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Kamera mendeteksi jemaat secara otomatis dan mencentang absensi kehadiran seketika.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(p => !p)}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={soundEnabled ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} className="text-rose-300" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Column 1 & 2: Video Viewfinder */}
          <div className="lg:col-span-2 bg-slate-950 p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[360px] sm:min-h-[460px]">
            {/* Video Viewport Container */}
            <div className="relative w-full h-full max-w-2xl max-h-[500px] flex items-center justify-center rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100" // Mirror for natural webcam experience
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
              />

              {/* Status overlay if not ready */}
              {(!modelLoaded || !cameraActive) && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                  <Loader2 size={36} className="text-blue-400 animate-spin" />
                  <p className="text-sm font-semibold text-slate-200">{loadingStatus}</p>
                </div>
              )}

              {/* Live Badge */}
              {cameraActive && (
                <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>LIVE KAMERA</span>
                </div>
              )}

              {/* Enrolled Badge */}
              {cameraActive && (
                <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-slate-200 text-[11px] font-medium px-3 py-1 rounded-full border border-slate-700/80 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>{enrolledCount} Wajah Terdaftar</span>
                </div>
              )}
            </div>

            {/* Bottom status bar */}
            <div className="mt-3 w-full max-w-2xl flex items-center justify-between text-xs text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                <span>{loadingStatus}</span>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                title="Muat ulang kamera"
              >
                <RefreshCw size={12} />
                <span>Reset Kamera</span>
              </button>
            </div>
          </div>

          {/* Column 3: Live Feed & Recognition Activity */}
          <div className="bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-4 flex flex-col max-h-[400px] lg:max-h-full overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Riwayat Deteksi Langsung
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {recentScans.length} terdeteksi
              </span>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2 space-y-1">
              {recentScans.length === 0 ? (
                <div className="py-12 text-center text-slate-400 px-4">
                  <Eye size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-600">Arahkan wajah ke kamera</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Jemaat yang menghadap kamera dan cocok dengan foto profil akan otomatis dicentang hadir di sini.
                  </p>
                </div>
              ) : (
                recentScans.map((scan, idx) => (
                  <div
                    key={`${scan.id}-${idx}`}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-emerald-300 transition-all flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>{scan.name}</span>
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>Pukul {scan.time}</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-semibold">{scan.confidence}% Cocok</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      scan.alreadyPresent
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {scan.alreadyPresent ? 'Sudah Hadir' : 'Dicentang ✓'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Information Tips */}
            <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200/80">
              <p className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                <Sparkles size={12} className="text-amber-500" /> Tips Pencahayaan
              </p>
              <p className="leading-tight text-slate-500">
                Pastikan wajah jemaat terkena cahaya cukup saat menghadap laptop / tablet agar kamera mengenali dengan cepat.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" />
            <span>
              Total jemaat dengan foto: <strong className="text-slate-800">{totalPhotosCount}</strong> dari {members.length} jemaat
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Selesai / Tutup Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
