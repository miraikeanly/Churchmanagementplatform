import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  Camera, X, Loader2, CheckCircle2, AlertCircle, RefreshCw,
  Sparkles, Users, UserCheck, ShieldCheck, Volume2, VolumeX, Eye,
  Search, Sliders, Check, Zap, HelpCircle
} from 'lucide-react';

interface FaceScannerProps {
  isOpen: boolean;
  onClose: () => void;
  members: Array<{
    id: string;
    name: string;
    photoUrl?: string;
    phone?: string;
    address?: string;
  }>;
  presentIds: Set<string>;
  onMarkPresent: (memberId: string) => void;
}

// Global memory cache for descriptors across modal opens so re-opening is INSTANT (0 seconds!)
const GLOBAL_DESCRIPTOR_CACHE = new Map<string, Float32Array>();

// Load image into an HTMLImageElement with crossOrigin & promise
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback: try without crossOrigin in case local or data URI
      const imgFallback = new Image();
      imgFallback.onload = () => resolve(imgFallback);
      imgFallback.onerror = (e) => reject(e);
      imgFallback.src = src;
    };
    img.src = src;
  });
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

  // Strict Sensitivity threshold: lower distance = stricter (Default 0.38 distance / ~75%+ strict matching)
  const [matchTolerance, setMatchTolerance] = useState<number>(0.38);
  const [showSettings, setShowSettings] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Unregistered face quick manual checkin popup
  const [unrecognizedDetected, setUnrecognizedDetected] = useState(false);

  const [recentScans, setRecentScans] = useState<Array<{
    id: string;
    name: string;
    time: string;
    confidence: number;
    alreadyPresent: boolean;
  }>>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const isDetectingRef = useRef(false);
  const lastCheckinTimesRef = useRef<Map<string, number>>(new Map()); // Debounce check-in per member
  const consecutiveMatchCountsRef = useRef<Map<string, number>>(new Map()); // Anti-passby: requires person to be steady for 3 consecutive frames

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
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // AudioContext maybe blocked by browser autoplay policy
    }
  }, [soundEnabled]);

  // 1. Load Face-API models fast with high-accuracy detectors
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadModels() {
      try {
        setLoadingStatus('Memuat model deteksi wajah AI (High Accuracy)...');
        const MODEL_URL = '/models';

        // Load SSD MobileNetV1 (full precision) + Landmark 68 + Recognition
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (isMounted) {
          setModelLoaded(true);
          setLoadingStatus('Model AI siap! Memproses foto wajah jemaat...');
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

  // 2. Pre-extract face descriptors with parallel batching and robust fallback detectors
  useEffect(() => {
    if (!isOpen || !modelLoaded) return;

    let isMounted = true;
    async function enrollMemberFaces() {
      // Filter members with valid photos
      const membersWithPhoto = members.filter(
        m => m.photoUrl && (m.photoUrl.startsWith('http') || m.photoUrl.startsWith('data:') || m.photoUrl.startsWith('/'))
      );
      setTotalPhotosCount(membersWithPhoto.length);

      if (membersWithPhoto.length === 0) {
        setLoadingStatus('Belum ada foto jemaat terdaftar. Tambahkan foto di Data Jemaat.');
        return;
      }

      setLoadingStatus(`Menyiapkan data wajah ${membersWithPhoto.length} jemaat...`);
      const descriptors: faceapi.LabeledFaceDescriptors[] = [];
      let enrolled = 0;

      // Check cache first for immediate readiness!
      const unanalyzedMembers: typeof membersWithPhoto = [];
      for (const m of membersWithPhoto) {
        const cached = GLOBAL_DESCRIPTOR_CACHE.get(m.photoUrl || m.id);
        if (cached) {
          descriptors.push(new faceapi.LabeledFaceDescriptors(m.id, [cached]));
          enrolled++;
        } else {
          unanalyzedMembers.push(m);
        }
      }

      if (isMounted && enrolled > 0) {
        setEnrolledCount(enrolled);
        faceMatcherRef.current = new faceapi.FaceMatcher(descriptors, matchTolerance);
        setLoadingStatus(`${enrolled} wajah jemaat siap dikenali secara instan!`);
      }

      // If all were cached, we are already 100% done!
      if (unanalyzedMembers.length === 0) {
        return;
      }

      // Process unanalyzed photos in parallel batches of 4
      const BATCH_SIZE = 4;
      for (let i = 0; i < unanalyzedMembers.length; i += BATCH_SIZE) {
        if (!isMounted) return;
        const batch = unanalyzedMembers.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async m => {
            try {
              const img = await loadImageElement(m.photoUrl!);

              // 1. Primary: Use full SsdMobilenetv1 for extremely high accuracy photo extraction
              let detection = await faceapi
                .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                .withFaceLandmarks(false) // Use full 68-point landmark model
                .withFaceDescriptor();

              // 2. Fallback: TinyFaceDetector with inputSize 320 for zoomed/low-contrast photos
              if (!detection) {
                detection = await faceapi
                  .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 }))
                  .withFaceLandmarks(false)
                  .withFaceDescriptor();
              }

              // 3. Fallback: TinyFaceDetector with inputSize 160 for small/compressed avatars
              if (!detection) {
                detection = await faceapi
                  .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.2 }))
                  .withFaceLandmarks(false)
                  .withFaceDescriptor();
              }

              if (detection && detection.descriptor) {
                GLOBAL_DESCRIPTOR_CACHE.set(m.photoUrl || m.id, detection.descriptor);
                descriptors.push(new faceapi.LabeledFaceDescriptors(m.id, [detection.descriptor]));
                enrolled++;
                if (isMounted) {
                  setEnrolledCount(enrolled);
                }
              }
            } catch {
              // Ignore image load/fetch errors
            }
          })
        );
      }

      if (isMounted) {
        if (descriptors.length > 0) {
          faceMatcherRef.current = new faceapi.FaceMatcher(descriptors, matchTolerance);
          setLoadingStatus(`AI Siap! ${descriptors.length} wajah jemaat siap discan.`);
        } else {
          setLoadingStatus('Foto profil belum dapat dideteksi AI. Arahkan wajah ke kamera.');
        }
      }
    }

    enrollMemberFaces();
    return () => {
      isMounted = false;
    };
  }, [isOpen, modelLoaded, members, matchTolerance]);

  // Re-instantiate face matcher when matchTolerance slider changes
  useEffect(() => {
    if (GLOBAL_DESCRIPTOR_CACHE.size > 0 && members.length > 0) {
      const descriptors: faceapi.LabeledFaceDescriptors[] = [];
      for (const m of members) {
        const cached = GLOBAL_DESCRIPTOR_CACHE.get(m.photoUrl || m.id);
        if (cached) {
          descriptors.push(new faceapi.LabeledFaceDescriptors(m.id, [cached]));
        }
      }
      if (descriptors.length > 0) {
        faceMatcherRef.current = new faceapi.FaceMatcher(descriptors, matchTolerance);
      }
    }
  }, [matchTolerance, members]);

  // 3. Start Camera (Natural aspect ratio & auto dimensions)
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

  // 4. Real-time Detection Loop with synchronized canvas coordinates
  useEffect(() => {
    if (!isOpen || !cameraActive || !videoRef.current) return;

    let animationFrameId: number;
    isDetectingRef.current = true;
    let frameSkip = 0;

    async function detectFaces() {
      if (!isDetectingRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Process every frame (smooth 30-60fps)
      if (video.readyState === 4 && canvas) {
        const videoWidth = video.videoWidth || 640;
        const videoHeight = video.videoHeight || 480;

        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }

        const displaySize = { width: videoWidth, height: videoHeight };

        try {
          // Use inputSize 320 for high landmark resolution and accurate descriptors
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
            .withFaceLandmarks(false) // use 68 full landmark model
            .withFaceDescriptors();

          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

          let hasUnrecognized = false;

          // If we have enrolled faces and faceMatcher
          if (faceMatcherRef.current && detections.length > 0) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // 1. Strict Filter: Filter out small/distant faces (passers-by in background)
            // Faces must have minimum bounding box width and height (at least 90px)
            const prominentDetections = resizedDetections.filter(d => {
              const b = d.detection.box;
              return b.width >= 90 && b.height >= 90;
            });

            // Calculate video center coordinates
            const centerX = videoWidth / 2;
            const centerY = videoHeight / 2;

            // 2. Process and match each prominent face
            const matchResults = prominentDetections.map(detection => {
              const bestMatch = faceMatcherRef.current!.findBestMatch(detection.descriptor);
              const isUnknown = bestMatch.label === 'unknown';
              const memberId = bestMatch.label;
              const matchedMember = members.find(m => m.id === memberId);
              const box = detection.detection.box;

              // Euclidean distance to percentage conversion:
              // Distance <= 0.30 -> >80%, 0.38 -> ~72%, 0.45 -> ~60%
              const confidence = Math.max(0, Math.min(100, Math.round((1 - bestMatch.distance / 0.75) * 100)));

              // Strict accuracy: Distance must be <= matchTolerance (default 0.38) and confidence >= 65%
              // An unknown match is NEVER accurate.
              const isHighlyAccurate = !isUnknown && Boolean(matchedMember) && bestMatch.distance <= matchTolerance && confidence >= 65;

              // Distance from frame center (center-weighted priority)
              const faceCenterX = box.x + box.width / 2;
              const faceCenterY = box.y + box.height / 2;
              const distFromCenter = Math.hypot(faceCenterX - centerX, faceCenterY - centerY);
              const faceArea = box.width * box.height;

              return {
                detection,
                box,
                bestMatch,
                isUnknown,
                isHighlyAccurate,
                memberId,
                matchedMember,
                confidence,
                distance: bestMatch.distance,
                distFromCenter,
                faceArea,
              };
            });

            // 3. Sort: prioritize closest to center and largest face, then lowest Euclidean distance
            matchResults.sort((a, b) => {
              if (a.isHighlyAccurate !== b.isHighlyAccurate) {
                return a.isHighlyAccurate ? -1 : 1;
              }
              return a.distance - b.distance;
            });

            const seenMemberIdsThisFrame = new Set<string>();

            for (let i = 0; i < matchResults.length; i++) {
              const res = matchResults[i];
              const { box, isHighlyAccurate, memberId, matchedMember, confidence } = res;

              if (!isHighlyAccurate) {
                hasUnrecognized = true;
              }

              const isAlreadyPresent = (isHighlyAccurate && memberId) ? presentIds.has(memberId) : false;

              // Draw bounding box on video canvas
              if (ctx) {
                ctx.lineWidth = 3;
                // Green for high-confidence match, Blue for already checked in, Red for unknown / not similar enough
                ctx.strokeStyle = !isHighlyAccurate ? '#ef4444' : isAlreadyPresent ? '#3b82f6' : '#10b981';
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                // Label background
                const labelText = !isHighlyAccurate
                  ? 'Wajah Kurang Mirip / Lewat Saja'
                  : isAlreadyPresent
                  ? `✓ ${matchedMember?.name || 'Jemaat'} (Sudah Hadir)`
                  : `${matchedMember?.name || 'Jemaat'} (${confidence}%)`;
                
                ctx.font = 'bold 15px sans-serif';
                const textWidth = ctx.measureText(labelText).width;
                ctx.fillStyle = !isHighlyAccurate
                  ? 'rgba(239, 68, 68, 0.9)'
                  : isAlreadyPresent
                  ? 'rgba(37, 99, 235, 0.9)'
                  : 'rgba(16, 185, 129, 0.95)';
                ctx.fillRect(box.x, Math.max(0, box.y - 28), textWidth + 16, 26);

                // Label text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, box.x + 8, Math.max(18, box.y - 9));
              }

              // Auto-checkin trigger with Anti-Passby Multi-Frame Confirmation:
              // Only process check-in for the primary match (first item) to prevent multi-person spam
              if (i === 0 && isHighlyAccurate && matchedMember && memberId) {
                seenMemberIdsThisFrame.add(memberId);

                // If member is not yet checked in in the session:
                if (!isAlreadyPresent) {
                  // Count consecutive frames this member was recognized (Anti-Passby verification)
                  const currentStreak = (consecutiveMatchCountsRef.current.get(memberId) || 0) + 1;
                  consecutiveMatchCountsRef.current.set(memberId, currentStreak);

                  // Must be stable for at least 3 consecutive frames (~200-300ms) to ensure they are actually looking at camera
                  if (currentStreak >= 3) {
                    const now = Date.now();
                    const lastCheckin = lastCheckinTimesRef.current.get(memberId) || 0;

                    // Debounce to prevent multiple triggers in rapid succession
                    if (now - lastCheckin > 8000) {
                      lastCheckinTimesRef.current.set(memberId, now);

                      // Mark present in attendance system
                      onMarkPresent(memberId);
                      playChime(true);

                      // Only push to recentScans feed ONCE when freshly checked in (NO spam!)
                      setRecentScans(prev => {
                        if (prev.some(s => s.id === memberId)) return prev;
                        return [
                          {
                            id: memberId,
                            name: matchedMember.name,
                            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            confidence,
                            alreadyPresent: false,
                          },
                          ...prev.slice(0, 19),
                        ];
                      });
                    }
                  }
                } else {
                  // Jemaat SUDAH diabsen sebelumnya:
                  // Status di kamera tetap biru ("Sudah Hadir"), tidak mengirim notifikasi spam lagi ke feed kanan!
                  const now = Date.now();
                  lastCheckinTimesRef.current.set(memberId, now);
                }
              }
            }

            // Reset streak for members not seen in this frame
            for (const [id] of consecutiveMatchCountsRef.current) {
              if (!seenMemberIdsThisFrame.has(id)) {
                consecutiveMatchCountsRef.current.delete(id);
              }
            }
          } else if (detections.length > 0 && ctx) {
            // No matcher ready yet, draw neutral blue tracking box
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            for (const d of resizedDetections) {
              const box = d.detection.box;
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#38bdf8';
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            }
          }

          setUnrecognizedDetected(hasUnrecognized);
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

  // Filtered members list for quick manual click in scanner modal
  const filteredQuickList = useMemo(() => {
    if (!searchFilter.trim()) return [];
    const q = searchFilter.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [members, searchFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Camera size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI Face Recognition Absensi</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-emerald-950 flex items-center gap-1 shadow-2xs">
                  <Zap size={10} /> Fast Match
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Arahkan kamera ke jemaat — sistem mengenali wajah dan otomatis mencentang kehadiran.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(p => !p)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showSettings ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Sensitivitas / Pengaturan AI"
            >
              <Sliders size={18} />
            </button>
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

        {/* Optional Settings Drawer */}
        {showSettings && (
          <div className="bg-slate-900 text-white px-5 py-3 border-b border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-300">Tingkat Ketat AI:</span>
              <input
                type="range"
                min="0.32"
                max="0.52"
                step="0.02"
                value={matchTolerance}
                onChange={e => setMatchTolerance(parseFloat(e.target.value))}
                className="w-32 accent-emerald-500 cursor-pointer"
              />
              <span className="font-bold text-emerald-400">
                {matchTolerance <= 0.35 ? 'Maksimal Ketat (Jarang Salah)' : matchTolerance <= 0.38 ? 'Ultra Ketat & Presisi (Rekomendasi)' : 'Toleransi Sedang'}
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Toleransi default 0.38 memastikan nama jemaat tidak akan tertukar dengan orang lain.
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Column 1 & 2: Video Viewfinder */}
          <div className="lg:col-span-2 bg-slate-950 p-3 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[380px] sm:min-h-[480px]">
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
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-20">
                  <Loader2 size={36} className="text-blue-400 animate-spin" />
                  <p className="text-sm font-semibold text-slate-200">{loadingStatus}</p>
                </div>
              )}

              {/* Live Badge */}
              {cameraActive && (
                <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md z-10">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>LIVE KAMERA</span>
                </div>
              )}

              {/* Enrolled Badge */}
              {cameraActive && (
                <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-md text-slate-200 text-[11px] font-semibold px-3 py-1 rounded-full border border-slate-700/80 flex items-center gap-1.5 z-10 shadow-md">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>{enrolledCount} Wajah Siap Dikenali</span>
                </div>
              )}

              {/* Notice if face seen but not in database */}
              {unrecognizedDetected && cameraActive && (
                <div className="absolute bottom-3 inset-x-3 bg-rose-950/90 border border-rose-500/80 backdrop-blur-md p-2.5 rounded-xl text-white text-xs flex items-center justify-between gap-2 z-10 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="text-rose-400 shrink-0" />
                    <span>Wajah terdeteksi tetapi belum terdaftar fotonya di database.</span>
                  </div>
                  <span className="text-[10px] text-rose-300 font-bold uppercase bg-rose-900/60 px-2 py-0.5 rounded">
                    Centang Manual
                  </span>
                </div>
              )}
            </div>

            {/* Bottom status bar */}
            <div className="mt-3 w-full max-w-2xl flex items-center justify-between text-xs text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${enrolledCount > 0 ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className="truncate max-w-xs">{loadingStatus}</span>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0 ml-2"
                title="Muat ulang kamera"
              >
                <RefreshCw size={12} />
                <span>Reset Kamera</span>
              </button>
            </div>
          </div>

          {/* Column 3: Live Feed & Quick Search */}
          <div className="bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-4 flex flex-col max-h-[420px] lg:max-h-full overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Riwayat Deteksi Langsung
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {recentScans.length} hadir
              </span>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2 space-y-1">
              {recentScans.length === 0 ? (
                <div className="py-10 text-center text-slate-400 px-4">
                  <Eye size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-600">Arahkan wajah ke kamera</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Jemaat yang menghadap kamera langsung otomatis dicentang hadir di sini.
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

            {/* Quick manual checkin fallback search right inside scanner modal */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Cari & centang jemaat manual jika belum ada foto..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {filteredQuickList.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                  {filteredQuickList.map(m => {
                    const isPres = presentIds.has(m.id);
                    return (
                      <div key={m.id} className="p-2 flex items-center justify-between hover:bg-slate-50">
                        <span className="text-xs font-semibold text-slate-800 truncate pr-2">{m.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            onMarkPresent(m.id);
                            playChime(true);
                            setSearchFilter('');
                          }}
                          className={`text-[10px] px-2 py-1 rounded-lg font-bold cursor-pointer ${
                            isPres ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isPres ? 'Sudah Hadir' : '+ Hadir'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" />
            <span>
              Total jemaat dengan foto: <strong className="text-slate-800">{totalPhotosCount}</strong> · Terdaftar AI: <strong className="text-emerald-700">{enrolledCount}</strong>
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
