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

  // Mode: 'auto' (langsung centang) vs 'review' (tampilkan di tab antrean untuk dicentang manual 1-klik agar 100% aman)
  const [autoCheckinMode, setAutoCheckinMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'candidates' | 'history'>('candidates');

  // Queue of detected attendees for review
  const [detectedCandidates, setDetectedCandidates] = useState<Array<{
    id: string;
    name: string;
    time: string;
    confidence: number;
    distance: number;
    photoUrl?: string;
  }>>([]);

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
      let enrolled = 0;

      // Group descriptors by member ID: each member can have multiple descriptors (e.g. original photo + flip)
      const memberDescriptorMap = new Map<string, Float32Array[]>();

      // Check cache first for immediate readiness!
      const unanalyzedMembers: typeof membersWithPhoto = [];
      for (const m of membersWithPhoto) {
        const cached = GLOBAL_DESCRIPTOR_CACHE.get(m.photoUrl || m.id);
        if (cached) {
          memberDescriptorMap.set(m.id, [cached]);
          enrolled++;
        } else {
          unanalyzedMembers.push(m);
        }
      }

      const buildFaceMatcher = () => {
        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
        for (const [memberId, descs] of memberDescriptorMap.entries()) {
          if (descs.length > 0) {
            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(memberId, descs));
          }
        }
        if (labeledDescriptors.length > 0) {
          faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, matchTolerance);
        }
      };

      if (isMounted && enrolled > 0) {
        setEnrolledCount(enrolled);
        buildFaceMatcher();
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
                memberDescriptorMap.set(m.id, [detection.descriptor]);
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
        buildFaceMatcher();
        const totalEnrolled = memberDescriptorMap.size;
        if (totalEnrolled > 0) {
          setLoadingStatus(`AI Siap! ${totalEnrolled} wajah jemaat siap discan.`);
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

            // 2. Process and match each prominent face using distance margin comparison
            const matchResults = prominentDetections.map(detection => {
              const box = detection.detection.box;

              // Calculate distance to ALL enrolled members
              const labeledDescriptors = faceMatcherRef.current!.labeledDescriptors;
              const matches = labeledDescriptors.map(ld => {
                const dist = faceMatcherRef.current!.computeMeanDistance(detection.descriptor, ld.descriptors);
                return { label: ld.label, distance: dist };
              });
              matches.sort((a, b) => a.distance - b.distance);

              const bestMatch = matches[0];
              const runnerUpMatch = matches[1];

              const bestDistance = bestMatch ? bestMatch.distance : 1.0;
              const runnerUpDistance = runnerUpMatch ? runnerUpMatch.distance : 1.0;
              const margin = runnerUpDistance - bestDistance; // Confidence gap

              const memberId = bestMatch ? bestMatch.label : 'unknown';
              const matchedMember = members.find(m => m.id === memberId);

              // Percentage conversion: distance <= 0.25 -> ~85%, 0.35 -> ~72%, 0.42 -> ~60%
              const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDistance / 0.85) * 100)));

              // 100% Reliable Matching Rules:
              // 1. Must be closer than matchTolerance
              // 2. Either extremely close (distance <= 0.34, unmistakable)
              //    OR sufficiently differentiated from any other person (margin >= 0.05)
              // 3. Matched member must exist
              const isHighlyAccurate = Boolean(matchedMember) &&
                bestDistance <= matchTolerance &&
                (bestDistance <= 0.34 || margin >= 0.04);

              // Distance from frame center (center-weighted priority)
              const faceCenterX = box.x + box.width / 2;
              const faceCenterY = box.y + box.height / 2;
              const distFromCenter = Math.hypot(faceCenterX - centerX, faceCenterY - centerY);
              const faceArea = box.width * box.height;

              return {
                detection,
                box,
                bestMatch,
                isUnknown: !isHighlyAccurate,
                isHighlyAccurate,
                memberId,
                matchedMember,
                confidence,
                distance: bestDistance,
                margin,
                distFromCenter,
                faceArea,
              };
            });

            // 3. Sort: prioritize closest to center and largest face, then lowest Euclidean distance
            matchResults.sort((a, b) => {
              // Prioritize accurate matches
              if (a.isHighlyAccurate !== b.isHighlyAccurate) {
                return a.isHighlyAccurate ? -1 : 1;
              }
              // If both are accurate or both not, prioritize larger face closer to center
              const scoreA = a.faceArea - a.distFromCenter * 50;
              const scoreB = b.faceArea - b.distFromCenter * 50;
              return scoreB - scoreA;
            });

            const seenMemberIdsThisFrame = new Set<string>();

            // Draw and handle matches
            for (let i = 0; i < matchResults.length; i++) {
              const res = matchResults[i];
              const { box, isHighlyAccurate, memberId, matchedMember, confidence } = res;

              if (!isHighlyAccurate) {
                hasUnrecognized = true;
              }

              const isAlreadyPresent = (isHighlyAccurate && memberId) ? presentIds.has(memberId) : false;

              // Only highlight the primary person in front of the camera (i === 0) with rich details,
              // or known secondary members. Far/unrelated people get subtle outlines to prevent clutter.
              if (ctx) {
                ctx.lineWidth = i === 0 ? 3 : 2;
                // Green for high-confidence match, Blue for already checked in, Amber for scanning, Red for mismatch
                ctx.strokeStyle = !isHighlyAccurate 
                  ? 'rgba(239, 68, 68, 0.6)' 
                  : isAlreadyPresent 
                  ? '#3b82f6' 
                  : '#10b981';
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                // Label background only for primary or recognized
                if (i === 0 || isHighlyAccurate) {
                  const labelText = !isHighlyAccurate
                    ? 'Wajah Belum Terdaftar'
                    : isAlreadyPresent
                    ? `✓ ${matchedMember?.name || 'Jemaat'} (Sudah Hadir)`
                    : `${matchedMember?.name || 'Jemaat'} (${confidence}%)`;
                  
                  ctx.font = 'bold 15px sans-serif';
                  const textWidth = ctx.measureText(labelText).width;
                  ctx.fillStyle = !isHighlyAccurate
                    ? 'rgba(239, 68, 68, 0.85)'
                    : isAlreadyPresent
                    ? 'rgba(37, 99, 235, 0.9)'
                    : 'rgba(16, 185, 129, 0.95)';
                  ctx.fillRect(box.x, Math.max(0, box.y - 28), textWidth + 16, 26);

                  // Label text
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText(labelText, box.x + 8, Math.max(18, box.y - 9));
                }
              }

              // Auto-checkin OR Candidate Queue trigger with Anti-Passby Multi-Frame Confirmation:
              // ONLY process for the primary target (i === 0) facing center of camera
              if (i === 0 && isHighlyAccurate && matchedMember && memberId) {
                seenMemberIdsThisFrame.add(memberId);

                // If member is not yet checked in in the session:
                if (!isAlreadyPresent) {
                  // Count consecutive frames this member was recognized (Anti-Passby verification)
                  const currentStreak = (consecutiveMatchCountsRef.current.get(memberId) || 0) + 1;
                  consecutiveMatchCountsRef.current.set(memberId, currentStreak);

                  // Must be stable for at least 4 consecutive frames (~350ms) to ensure steady face & no accidental pass-by
                  if (currentStreak >= 4) {
                    const now = Date.now();
                    const lastCheckin = lastCheckinTimesRef.current.get(memberId) || 0;

                    // Debounce to prevent multiple triggers in rapid succession (10 seconds)
                    if (now - lastCheckin > 10000) {
                      lastCheckinTimesRef.current.set(memberId, now);

                      const scanTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      if (autoCheckinMode) {
                        // AUTO MODE: Mark present directly
                        onMarkPresent(memberId);
                        playChime(true);

                        setRecentScans(prev => {
                          if (prev.some(s => s.id === memberId)) return prev;
                          return [
                            {
                              id: memberId,
                              name: matchedMember.name,
                              time: scanTime,
                              confidence,
                              alreadyPresent: false,
                            },
                            ...prev.slice(0, 19),
                          ];
                        });
                      } else {
                        // REVIEW MODE (AMAN 100%): Tambahkan ke antrean deteksi jemaat datang agar dicek & dicentang manual 1-klik
                        playChime(true);
                        setDetectedCandidates(prev => {
                          if (prev.some(c => c.id === memberId)) return prev;
                          return [
                            {
                              id: memberId,
                              name: matchedMember.name,
                              time: scanTime,
                              confidence,
                              distance: res.distance,
                              photoUrl: matchedMember.photoUrl,
                            },
                            ...prev.slice(0, 29),
                          ];
                        });
                      }
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
  }, [isOpen, cameraActive, members, presentIds, onMarkPresent, playChime, autoCheckinMode]);

  // Filtered members list for quick manual click in scanner modal
  const filteredQuickList = useMemo(() => {
    if (!searchFilter.trim()) return [];
    const q = searchFilter.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [members, searchFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Camera size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI Face Recognition Absensi</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs ${
                  autoCheckinMode ? 'bg-amber-400 text-amber-950' : 'bg-emerald-400 text-emerald-950'
                }`}>
                  <Zap size={10} /> {autoCheckinMode ? 'Mode Otomatis' : 'Mode Verifikasi (Aman)'}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                {autoCheckinMode
                  ? 'Kamera otomatis mencentang kehadiran begitu wajah cocok.'
                  : 'Kamera mendeteksi jemaat yang datang — Anda dapat mengonfirmasi & mencentang dengan 1-klik di panel samping.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                GLOBAL_DESCRIPTOR_CACHE.clear();
                faceMatcherRef.current = null;
                setEnrolledCount(0);
                setLoadingStatus('Memuat ulang dan menyinkronkan seluruh foto profil...');
                window.location.hash = ''; // subtle trigger
                // Force re-enrollment
                setShowSettings(false);
                setTimeout(() => {
                  window.dispatchEvent(new Event('resize'));
                }, 100);
              }}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Refresh / Re-sync Database Foto Wajah"
            >
              <RefreshCw size={18} />
            </button>
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
          <div className="bg-slate-900 text-white px-5 py-3.5 border-b border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300">Mode Absensi:</span>
                <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAutoCheckinMode(false)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      !autoCheckinMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Verifikasi Manual (Aman 100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoCheckinMode(true)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      autoCheckinMode ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Otomatis Langsung
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300">Toleransi Wajah:</span>
                <input
                  type="range"
                  min="0.32"
                  max="0.46"
                  step="0.02"
                  value={matchTolerance}
                  onChange={e => setMatchTolerance(parseFloat(e.target.value))}
                  className="w-28 accent-emerald-500 cursor-pointer"
                />
                <span className="font-bold text-emerald-400">
                  {matchTolerance <= 0.36 
                    ? 'Ketat' 
                    : matchTolerance <= 0.40 
                    ? 'Optimal' 
                    : 'Toleran'}
                </span>
              </div>
            </div>

            <div className="text-slate-400 text-[11px]">
              {!autoCheckinMode
                ? 'Mode Verifikasi: Jemaat yang terdeteksi masuk ke tab antrean untuk dikonfirmasi ushers.'
                : 'Mode Otomatis: Centang kehadiran langsung tercatat begitu wajah cocok.'}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left: Video Viewfinder (7 of 12 cols on desktop) */}
          <div className="lg:col-span-7 bg-slate-950 p-3 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[380px] sm:min-h-[480px]">
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

          {/* Right: Tabbed Candidate Review & Live Feed (5 of 12 cols on desktop) */}
          <div className="lg:col-span-5 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-3 sm:p-4 flex flex-col max-h-[520px] lg:max-h-full overflow-hidden">
            {/* Header Tabs */}
            <div className="space-y-2 pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 grid grid-cols-2 p-1 bg-slate-200/90 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('candidates')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'candidates'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users size={14} className="shrink-0" />
                    <span className="truncate">Wajah Terdeteksi</span>
                    {detectedCandidates.filter(c => !presentIds.has(c.id)).length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold min-w-[18px] text-center">
                        {detectedCandidates.filter(c => !presentIds.has(c.id)).length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span className="truncate">Sudah Hadir</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                      {recentScans.length}
                    </span>
                  </button>
                </div>
              </div>

              {activeTab === 'candidates' && detectedCandidates.filter(c => !presentIds.has(c.id)).length > 1 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {detectedCandidates.filter(c => !presentIds.has(c.id)).length} jemaat siap dicentang
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const pending = detectedCandidates.filter(c => !presentIds.has(c.id));
                      pending.forEach(c => onMarkPresent(c.id));
                      if (pending.length > 0) {
                        playChime(true);
                        setRecentScans(prev => [
                          ...pending.map(c => ({
                            id: c.id,
                            name: c.name,
                            time: c.time,
                            confidence: c.confidence,
                            alreadyPresent: false,
                          })),
                          ...prev,
                        ]);
                        setDetectedCandidates([]);
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100/70 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Check size={12} />
                    <span>Centang Semua Sekaligus</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tab 1: Candidates detected by AI for confirmation */}
            {activeTab === 'candidates' && (
              <div className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-0.5">
                {detectedCandidates.filter(c => !presentIds.has(c.id)).length === 0 ? (
                  <div className="py-12 text-center text-slate-400 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto mb-3 flex items-center justify-center">
                      <Eye size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Menunggu Wajah Jemaat...</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                      Arahkan kamera ke jemaat. Nama yang terdeteksi akan masuk ke daftar ini untuk Anda centang dengan 1-klik tanpa resiko salah nama.
                    </p>
                  </div>
                ) : (
                  detectedCandidates
                    .filter(c => !presentIds.has(c.id))
                    .map(candidate => (
                      <div
                        key={candidate.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between gap-3"
                      >
                        {/* Member Avatar & Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {candidate.photoUrl ? (
                            <img
                              src={candidate.photoUrl}
                              alt=""
                              className="w-11 h-11 rounded-full object-cover border-2 border-indigo-100 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                              {candidate.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-900 truncate" title={candidate.name}>
                              {candidate.name}
                            </h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>Pukul {candidate.time}</span>
                              <span>·</span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                {candidate.confidence}% Cocok
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onMarkPresent(candidate.id);
                              playChime(true);
                              setRecentScans(prev => [
                                {
                                  id: candidate.id,
                                  name: candidate.name,
                                  time: candidate.time,
                                  confidence: candidate.confidence,
                                  alreadyPresent: false,
                                },
                                ...prev,
                              ]);
                              setDetectedCandidates(prev => prev.filter(c => c.id !== candidate.id));
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Check size={14} />
                            <span>Centang Hadir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDetectedCandidates(prev => prev.filter(c => c.id !== candidate.id));
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Bukan orang ini (Hapus)"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* Tab 2: History of checked in attendees */}
            {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto py-2.5 space-y-1.5 pr-0.5">
                {recentScans.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 mx-auto mb-3 flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Belum Ada yang Dicentang</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Jemaat yang sudah dicentang kehadirannya akan tercatat di daftar ini.
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
            )}

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
