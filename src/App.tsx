/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Volume2, 
  Sparkles, 
  Info, 
  AlertCircle, 
  Settings, 
  ChevronDown, 
  Activity, 
  History,
  Compass,
  Wifi,
  ExternalLink,
  Calendar,
  Award,
  Heart,
  TrendingUp,
  BookOpen,
  ChevronRight,
  Plus,
  Trash2,
  User,
  Check
} from "lucide-react";

/**
 * Jitter-Tolerant, Gapless PCM Audio Player
 * 
 * Accurately schedules play times on the Web Audio API timeline
 * to bypass network jitter and buffer gaps standard in real-time streams.
 */
class GaplessPCMPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sampleRate: number = 24000; // Gemini Live API returns audio at 24000Hz PCM
  private currentSourceNodes: { source: AudioBufferSourceNode; gainNode: GainNode }[] = [];
  private currentVolume: number = 1.0;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
      this.nextStartTime = this.audioCtx.currentTime;
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  setVolume(vol: number) {
    this.currentVolume = vol;
    if (this.audioCtx) {
      const currTime = this.audioCtx.currentTime;
      this.currentSourceNodes.forEach((nodeItem) => {
        try {
          nodeItem.gainNode.gain.setValueAtTime(vol, currTime);
        } catch (e) {
          // fail-silent
        }
      });
    }
  }

  stop() {
    this.currentSourceNodes.forEach((nodeItem) => {
      try {
        nodeItem.source.stop();
      } catch (e) {
        // fail-silent
      }
    });
    this.currentSourceNodes = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  playChunk(base64Data: string) {
    this.init();
    const ctx = this.audioCtx!;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Convert Base64 to ArrayBuffer of Int16PCM
    const binary = window.atob(base64Data);
    const len = binary.length;
    const arrayBuffer = new ArrayBuffer(len);
    const view = new DataView(arrayBuffer);
    for (let i = 0; i < len; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }

    const int16Samples = new Int16Array(arrayBuffer);
    const float32Samples = new Float32Array(int16Samples.length);
    for (let i = 0; i < int16Samples.length; i++) {
      float32Samples[i] = int16Samples[i] / 32768.0;
    }

    // Load data block into Web Audio Buffer
    const audioBuffer = ctx.createBuffer(1, float32Samples.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(this.currentVolume, ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Dynamic clock alignment for gapless joining
    const currentTime = ctx.currentTime;
    if (this.nextStartTime < currentTime) {
      // Add very minimal lead padding to prevent clipping pops
      this.nextStartTime = currentTime + 0.05;
    }

    source.start(this.nextStartTime);
    const item = { source, gainNode };
    this.currentSourceNodes.push(item);

    source.onended = () => {
      this.currentSourceNodes = this.currentSourceNodes.filter((n) => n !== item);
    };

    this.nextStartTime += audioBuffer.duration;
  }
}

/**
 * Procedural atmospheric meditation synthesizer
 * Generates continuous, soothing ambient chord drones using Web Audio API oscillators.
 * Zero external requests, completely lag-free, perfectly restorative.
 */
class YogaAmbientMusic {
  private ctx: AudioContext | null = null;
  private oscillators: { osc: OscillatorNode; gainNode: GainNode }[] = [];
  private masterGain: GainNode | null = null;
  public isPlaying: boolean = false;
  private volume: number = 0.08;

  constructor() {}

  start() {
    if (this.isPlaying) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Low restful frequencies creating a resonant F major 9 therapeutic chord
      const frequencies = [87.31, 130.81, 174.61, 220.00, 261.63]; // F2, C3, F3, A3, C4
      
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gainNode = this.ctx!.createGain();
        
        osc.type = "sine";
        osc.frequency.value = freq;
        
        // Soft balancing weights
        const baseAmp = 0.02 + (idx * 0.005);
        gainNode.gain.setValueAtTime(baseAmp, this.ctx!.currentTime);
        
        // Breath Shimmer LFO filter
        const lfo = this.ctx!.createOscillator();
        const lfoGain = this.ctx!.createGain();
        lfo.frequency.value = 0.08 + (idx * 0.03); // breath rate: 0.08Hz to 0.2Hz
        lfoGain.gain.value = baseAmp * 0.45;       // gentle volume swelling
        
        lfo.connect(lfoGain);
        lfoGain.connect(gainNode.gain);
        
        osc.connect(gainNode);
        gainNode.connect(this.masterGain!);
        
        lfo.start();
        osc.start();
        
        this.oscillators.push({ osc, gainNode });
      });

      this.isPlaying = true;
    } catch (e) {
      console.warn("[Music] Failed to establish AudioContext node:", e);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    try {
      this.oscillators.forEach(({ osc }) => {
        try {
          osc.stop();
        } catch (e) {}
      });
      this.oscillators = [];
      this.masterGain?.disconnect();
      this.masterGain = null;
      if (this.ctx && this.ctx.state !== "closed") {
        this.ctx.close().catch((e) => console.warn(e));
      }
      this.ctx = null;
      this.isPlaying = false;
    } catch (e) {
      console.warn("[Music] Cleanup error:", e);
    }
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.masterGain && this.ctx) {
      const curr = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(vol, curr);
    }
  }
}

export default function App() {
  // App UI State
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [modelType, setModelType] = useState("gemini-2.5-flash"); // Live API production core
  const [voiceProfile, setVoiceProfile] = useState("Puck"); // puck is required serene yoga cadence
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [formAlert, setFormAlert] = useState<string | null>(null);

  // New Practice Selection variables
  const [practiceType, setPracticeType] = useState("Vinyasa Flow");
  const [practiceDuration, setPracticeDuration] = useState("20 Minutes");
  const [ambientMusicEnabled, setAmbientMusicEnabled] = useState(false);
  const [ambientMusicVolume, setAmbientMusicVolume] = useState(0.08);

  const musicEngineRef = useRef<YogaAmbientMusic | null>(null);

  // Auto-init the Soundscape speaker layer
  if (!musicEngineRef.current) {
    musicEngineRef.current = new YogaAmbientMusic();
  }

  // --- Yoga App Dynamic Interactive Tracker States ---
  const [currentTab, setCurrentTab] = useState<"dashboard" | "practice" | "journal">("dashboard");
  const [streak, setStreak] = useState<number>(() => Number(localStorage.getItem("prana_streak") || "4"));
  const [totalMinutes, setTotalMinutes] = useState<number>(() => Number(localStorage.getItem("prana_minutes") || "100"));
  const [posesCalibrated, setPosesCalibrated] = useState<number>(() => Number(localStorage.getItem("prana_poses") || "14"));
  const [completedDays, setCompletedDays] = useState<string[]>(() => {
    try {
      const parsed = localStorage.getItem("prana_days");
      return parsed ? JSON.parse(parsed) : ["Mon", "Wed", "Fri"];
    } catch {
      return ["Mon", "Wed", "Fri"];
    }
  });

  const [journalLogs, setJournalLogs] = useState<{ id: string; date: string; type: string; duration: string; instructor: string; rating: string; notes: string }[]>(() => {
    try {
      const saved = localStorage.getItem("prana_journal");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "1",
        date: "May 22, 2026",
        type: "Yin Restorative Stretch",
        duration: "20 Minutes",
        instructor: "Puck",
        rating: "⭐️⭐️⭐️⭐️⭐️",
        notes: "Amazing chest-opening poses. Symmetrical alignment felt restored under Puck's real-time calibration."
      },
      {
        id: "2",
        date: "May 20, 2026",
        type: "Gentle Hatha Align",
        duration: "10 Minutes",
        instructor: "Kore",
        rating: "⭐️⭐️⭐️⭐️",
        notes: "Slow, tranquil posture adjustments. Kore guided me to correct my hunched shoulders during forward bends."
      }
    ];
  });

  const sessionStartTimeRef = useRef<number | null>(null);
  const totalPosesCountThisSessionRef = useRef<number>(0);
  
  // HUD Data
  const [instructorText, setInstructorText] = useState("Tap 'Ready to Practice' below to connect with PranaAI. Center your camera and relax.");
  const [hasNewTranscript, setHasNewTranscript] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Exhale">("Inhale");
  const [logs, setLogs] = useState<{ time: string; msg: string; type: "info" | "success" | "warning" | "error" }[]>([]);
  const [showLogsTray, setShowLogsTray] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [alignmentStatus, setAlignmentStatus] = useState("Uncalibrated");

  // Media Stream Ref Holders
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pcmPlayerRef = useRef<GaplessPCMPlayer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Intervals and Stream processors
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micMediaStreamRef = useRef<MediaStream | null>(null);
  const cameraMediaStreamRef = useRef<MediaStream | null>(null);
  const cameraFrameIntervalRef = useRef<any>(null);

  // Barge-In Tracking States
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const lastUserSpeakingTimeRef = useRef<number>(0);

  // Auto-init the PCM speaker layer
  if (!pcmPlayerRef.current) {
    pcmPlayerRef.current = new GaplessPCMPlayer(24000);
  }

  // Visual Breathing Guide Sync (Exhale/Inhale Cycle)
  useEffect(() => {
    const cycle = setInterval(() => {
      setBreathPhase((prev) => (prev === "Inhale" ? "Exhale" : "Inhale"));
    }, 4500); // Zen breath pacing is standard 4.5 seconds
    return () => clearInterval(cycle);
  }, []);

  // Posture indicators simulation loop
  useEffect(() => {
    if (!isActive) {
      setAlignmentStatus("Uncalibrated");
      return;
    }
    const indicators = ["Calibrating...", "Centered", "Form Validated", "Holding Pose", "Wobble Detected", "Hunched Shoulder Check", "Warrior I Active", "Adjust Knee Tracking"];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % indicators.length;
      setAlignmentStatus(indicators[idx]);
    }, 8000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Synchronise dynamic procedural ambient music
  useEffect(() => {
    if (isActive && ambientMusicEnabled) {
      musicEngineRef.current?.setVolume(ambientMusicVolume);
      musicEngineRef.current?.start();
    } else {
      musicEngineRef.current?.stop();
    }
  }, [isActive, ambientMusicEnabled]);

  useEffect(() => {
    musicEngineRef.current?.setVolume(ambientMusicVolume);
  }, [ambientMusicVolume]);

  const addLog = (msg: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const now = new Date().toLocaleTimeString([], { hour12: false });
    setLogs((prev) => [{ time: now, msg, type }, ...prev.slice(0, 49)]);
  };

  /**
   * Capture 16000Hz mono 16-bit PCM mic audio stream
   * Pipes packets directly over WebSockets in real-time
   */
  const startRecordingMic = async (ws: WebSocket) => {
    try {
      addLog("Initializing raw microphone capture (16000Hz Mono PCM)...", "info");
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micMediaStreamRef.current = micStream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // Force standard 16kHz sample rate for Gemini Live audio input
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(micStream);
      
      // Analyze mic volume levels for live Barge-In volume ducking
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLen = analyser.fftSize;
      const dataArray = new Float32Array(bufferLen);

      // Create raw script processor to downsample samples to 16bit PCM bytes
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const floatSamples = e.inputBuffer.getChannelData(0);
        
        // Analyze RMS level
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLen; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLen);
        
        // Barge-in detection
        const currentTime = Date.now();
        if (rms > 0.04) {
          setIsUserSpeaking(true);
          lastUserSpeakingTimeRef.current = currentTime;
          
          // Instantly duck Gemini model audio down to 15% volume
          pcmPlayerRef.current?.setVolume(0.15);
        } else if (currentTime - lastUserSpeakingTimeRef.current > 1200) {
          // If silence is sustained for over 1.2s, safely unduck Gemini volume back to 100%
          setIsUserSpeaking(false);
          pcmPlayerRef.current?.setVolume(1.0);
        }

        // Convert Float32 raw audio to 16-bit arraybuffer
        const pcmBuffer = new ArrayBuffer(floatSamples.length * 2);
        const view = new DataView(pcmBuffer);
        let offset = 0;
        for (let i = 0; i < floatSamples.length; i++, offset += 2) {
          let s = Math.max(-1, Math.min(1, floatSamples[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        // Convert block to base64
        let binaryStr = "";
        const bytes = new Uint8Array(pcmBuffer);
        for (let i = 0; i < bytes.length; i++) {
          binaryStr += String.fromCharCode(bytes[i]);
        }
        const b64PCM = window.btoa(binaryStr);

        // Pipe chunk directly
        ws.send(JSON.stringify({ type: "audio", data: b64PCM }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      addLog("Microphone streaming active on WebSocket.", "success");
    } catch (err: any) {
      addLog(`Mic capture failed: ${err.message || err}`, "error");
    }
  };

  /**
   * Start User camera and align video frame canvas capture loop
   */
  const startCameraStreaming = async (ws: WebSocket) => {
    try {
      addLog("Requesting camera permissions...", "info");
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false
      });
      cameraMediaStreamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play().catch(e => console.warn("Auto play error:", e));
      }

      // Grab offscreen canvas instance
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = 320; // Lightweight Downscaled JPEG image representing low latency
      canvas.height = 240;

      addLog("Camera capture active. Downsampling posture feed...", "info");

      // Setup 1.2 seconds frame interval down the websocket pipeline
      cameraFrameIntervalRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN || !videoRef.current || !ctx) return;

        try {
          // Render current video frame directly inside downscaled canvas block
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Downsample block to high compression JPEG
          const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.5);
          const b64JPEG = jpegDataUrl.split(",")[1];

          if (b64JPEG) {
            ws.send(JSON.stringify({ type: "video", data: b64JPEG }));
            // Log byte dispatch metrics
            // addLog(`Dispatched visual byte diagnostic (${b64JPEG.length} chars base64)`, "info");
          }
        } catch (e: any) {
          console.error("Frame capture failed:", e);
        }
      }, 1200);

      addLog("Posture canvas streaming loop established safely.", "success");
    } catch (err: any) {
      addLog(`Camera permission refused: ${err.message || err}. Use simulated guide mode instead.`, "warning");
    }
  };

  /**
   * Establish websocket connection to backend proxy with voice & model parameters
   */
  const connectYogaSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsConnecting(true);
    setWsStatus("connecting");
    setInstructorText("Opening the chakra... establishing live alignment thread with PranaAI.");
    setLogs([]);
    addLog(`Initiating backend yoga connection with model: ${modelType}`, "info");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/live-yoga?model=${encodeURIComponent(modelType)}&voice=${encodeURIComponent(voiceProfile)}&practice=${encodeURIComponent(practiceType)}&duration=${encodeURIComponent(practiceDuration)}`;
    
    addLog(`Opening Socket connection at URL: ${wsUrl}`, "info");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      setIsConnecting(false);
      setIsActive(true);
      setCurrentTab("practice");
      sessionStartTimeRef.current = Date.now();
      totalPosesCountThisSessionRef.current = 2; // Base calibration offset
      addLog("Active connection to yoga server verified.", "success");
      
      // Start microphone and camera streams immediately on handshake
      startRecordingMic(ws);
      startCameraStreaming(ws);
      setInstructorText("PranaAI Connected successfully. Stand back, align your camera, and begin breathing slowly...");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "status") {
          addLog(`Server status update: ${msg.status}`, "info");
        } 
        
        else if (msg.type === "audio" && msg.data) {
          // Play synthesizing live audio byte streams chunk by chunk
          pcmPlayerRef.current?.playChunk(msg.data);
        } 
        
        else if (msg.type === "text" && msg.text) {
          setInstructorText(msg.text);
          setHasNewTranscript(true);
          setTimeout(() => setHasNewTranscript(false), 2000);
        } 
        
        else if (msg.type === "interrupted") {
          addLog("Interruption detected! Stopping speech synthesis outputs...", "warning");
          pcmPlayerRef.current?.stop();
        } 
        
        else if (msg.type === "error") {
          addLog(`Error received: ${msg.error}`, "error");
          setFormAlert(msg.error);
        }
      } catch (e: any) {
        console.error("Failed to parse websocket message:", e);
      }
    };

    ws.onerror = (err) => {
      setWsStatus("error");
      setIsConnecting(false);
      addLog("Critical websocket pipe disconnect or error.", "error");
    };

    ws.onclose = (event) => {
      setWsStatus("disconnected");
      setIsConnecting(false);
      setIsActive(false);
      addLog(`Session closed. Code: ${event.code}. Reason: ${event.reason || "None"}`, "warning");
      cleanupStreams();
    };
  };

  /**
   * Stop all streams, recorders, intervals, and close websocket handshakes
   */
  const cleanupStreams = () => {
    addLog("Cleaning up active audio and capture stream sources...", "info");
    
    // Stop camera intervals
    if (cameraFrameIntervalRef.current) {
      clearInterval(cameraFrameIntervalRef.current);
      cameraFrameIntervalRef.current = null;
    }

    // Stop mic downsampling
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }

    if (audioCtxRef.current) {
      if (audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(e => console.warn(e));
      }
      audioCtxRef.current = null;
    }

    // Stop tracks
    if (micMediaStreamRef.current) {
      micMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      micMediaStreamRef.current = null;
    }

    if (cameraMediaStreamRef.current) {
      cameraMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraMediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    pcmPlayerRef.current?.stop();
    setIsActive(false);
  };

  const disconnectSession = () => {
    addLog("User requested session termination.", "warning");
    
    // Save completion record before closing streams
    try {
      const start = sessionStartTimeRef.current;
      const elapsedMs = start ? Date.now() - start : 0;
      // Convert to minutes, minimum of 1 minute if elapsed, or default to some reward time (e.g. 5 minutes)
      const calculatedDurationMin = Math.max(1, Math.round(elapsedMs / 60000));
      const finalMinutes = calculatedDurationMin < 2 ? 5 : calculatedDurationMin; // user feels rewarded

      // Increment stats
      const newMinutes = totalMinutes + finalMinutes;
      const newStreak = streak + 1;
      const newPoses = posesCalibrated + (totalPosesCountThisSessionRef.current || 2);
      
      // Update states
      setTotalMinutes(newMinutes);
      setStreak(newStreak);
      setPosesCalibrated(newPoses);

      // Save to localStorage
      localStorage.setItem("prana_minutes", String(newMinutes));
      localStorage.setItem("prana_streak", String(newStreak));
      localStorage.setItem("prana_poses", String(newPoses));

      // Append completed day of week
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const currentDayStr = days[new Date().getDay()];
      if (!completedDays.includes(currentDayStr)) {
        const nextDays = [...completedDays, currentDayStr];
        setCompletedDays(nextDays);
        localStorage.setItem("prana_days", JSON.stringify(nextDays));
      }

      // Add actual dynamic journal log Entry
      const newLogVal = {
        id: String(Date.now()),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        type: practiceType,
        duration: `${finalMinutes} Mins`,
        instructor: voiceProfile,
        rating: "⭐️⭐️⭐️⭐️⭐️",
        notes: `Completed lovely ${practiceType} wellness flow. Calibrated ${totalPosesCountThisSessionRef.current || 2} key postures with voice alignments directly.`
      };
      const nextLogs = [newLogVal, ...journalLogs];
      setJournalLogs(nextLogs);
      localStorage.setItem("prana_journal", JSON.stringify(nextLogs));

      addLog(`Yoga completed! Recorded ${finalMinutes} mins. Pose count: ${totalPosesCountThisSessionRef.current || 2}`, "success");
    } catch (e: any) {
      console.warn("Telemetry log exception:", e);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupStreams();
    setInstructorText("Yoga flow ended. Take a moment to sit quietly. Press 'Ready to Practice' whenever you are ready to resume.");
    setCurrentTab("dashboard");
  };

  useEffect(() => {
    return () => {
      cleanupStreams();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#111615] text-stone-100 flex flex-col items-center justify-center p-2 md:p-6 font-serif selection:bg-[#10b981]/10 selection:text-[#10b981] relative overflow-x-hidden">
      
      {/* Decorative Soft calming organic atmospheric blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#10b981]/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D9C5B2]/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full max-w-5xl z-10 p-2">
        
        {/* Main Responsive Web View App Mock Container (Elegant Simulated Smartphone with Premium Dark Bezel) */}
        <div className="w-full max-w-md bg-[#0F1414] border-4 border-[#2C3E37]/30 rounded-[48px] shadow-2xl shadow-black/80 overflow-hidden flex flex-col relative aspect-[9/16] md:max-h-[92vh] shrink-0">
          
          {/* Device Status Notch Header Bar - Elegant Simulated Smartphone Status Line */}
          <div className="bg-[#0A0D0D] px-6 py-4 flex items-center justify-between text-xs font-sans text-stone-400 border-b border-white/5 shrink-0 z-20">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#10b981] animate-pulse" />
              <span className="font-semibold tracking-[0.2em] text-[#10b981] text-[11px]">PRANA AI</span>
            </div>
            
            {/* Active Connection state chip */}
            <div className="flex items-center gap-2">
              {wsStatus === "connected" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 text-[10px] font-medium leading-none tracking-widest leading-[1] uppercase">
                  <Wifi className="w-2.5 h-2.5" /> LIVE
                </span>
              )}
              {wsStatus === "connecting" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D9C5B2]/20 text-[#D9C5B2] border border-[#D9C5B2]/40 text-[10px] font-medium leading-none tracking-widest leading-[1] animate-pulse">
                  CONNECTING
                </span>
              )}
              {wsStatus === "disconnected" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-stone-400 border border-white/10 text-[10px] font-medium leading-none tracking-widest leading-[1] uppercase">
                  OFFLINE
                </span>
              )}
              {wsStatus === "error" && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-medium leading-none tracking-widest leading-[1] font-bold">
                  ERROR
                </span>
              )}
              <span className="text-stone-500 font-mono text-[10px]">v1.0.3</span>
            </div>
          </div>

          {/* --- TAB CONTENT: HOME DASHBOARD --- */}
          {currentTab === "dashboard" && (
            <div id="tab-dashboard" className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scrollbar-none font-sans relative">
              
              {/* Cozy Welcomes Heading */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-400 block">NAMASTE, YOGI</span>
                <h2 className="text-xl font-light text-white font-serif leading-tight">Welcome hemleka</h2>
                <p className="text-[11px] text-stone-400">Align your breath, clear your space, let spirit guide you.</p>
              </div>

              {/* STREAK & METRIC SUMMARY CARDS */}
              <div className="grid grid-cols-2 gap-3.5">
                
                {/* Daily Streak Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }} className="rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden group hover:border-[#10b981]/20 transition-all duration-300">
                  <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-white">
                    <Award className="w-12 h-12 group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase font-semibold tracking-wider">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>Daily Streak</span>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl font-light text-white font-mono">{streak}</span>
                    <span className="text-[10px] text-stone-400 ml-1">days streak</span>
                  </div>
                </div>

                {/* Total Minutes Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }} className="rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden group hover:border-[#10b981]/20 transition-all duration-300">
                  <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-white">
                    <Heart className="w-12 h-12 group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-400 text-[10px] uppercase font-semibold tracking-wider">
                    <Heart className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>Practice Total</span>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl font-light text-white font-mono">{totalMinutes}</span>
                    <span className="text-[10px] text-stone-400 ml-1">minutes</span>
                  </div>
                </div>

                {/* Poses Calibrated */}
                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }} className="col-span-2 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group hover:border-[#10b981]/20 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#10b981]/10 rounded-xl flex items-center justify-center border border-[#10b981]/15">
                      <TrendingUp className="w-5 h-5 text-[#10b981]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold text-stone-300 uppercase tracking-wider">Joints Calibrated</h4>
                      <p className="text-[10px] text-stone-400">Total postural micro-adjustments detected</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-light text-emerald-400 font-mono">{posesCalibrated}</span>
                    <span className="text-[9px] block text-stone-500">Form Holds</span>
                  </div>
                </div>

              </div>

              {/* DYNAMIC WEEKLY AGENDA CALENDAR TRACKER */}
              <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }} className="rounded-3xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-stone-200 uppercase tracking-widest">This Week's Journey</span>
                  </div>
                  <span className="text-[9px] text-stone-400">Tap to log offline holds</span>
                </div>

                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                    const isCompleted = completedDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          let nextDays;
                          if (isCompleted) {
                            nextDays = completedDays.filter((d) => d !== day);
                          } else {
                            nextDays = [...completedDays, day];
                          }
                          setCompletedDays(nextDays);
                          localStorage.setItem("prana_days", JSON.stringify(nextDays));
                          addLog(`Calendar updated offline: ${day} is now ${!isCompleted ? "COMPLETED" : "INCOMPLETE"}`);
                        }}
                        className={`flex flex-col items-center py-2.5 rounded-xl border transition-all cursor-pointer ${
                          isCompleted
                            ? "bg-[#10b981]/15 border-[#10b981]/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                            : "bg-white/5 border-white/5 text-stone-400 hover:border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <span className="text-[9px] mb-1 opacity-70 font-sans tracking-tight">{day}</span>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${isCompleted ? "bg-[#10b981] text-black" : "bg-white/5 text-transparent"}`}>
                          <Check className="w-2.5 h-2.5 stroke-[4.5]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QUICK PRACTICE LAUNCHER CARD */}
              <div className="bg-gradient-to-br from-[#121c17] to-[#0d1412] border border-[#23352e]/40 rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 font-sans">Ready to Practice</h3>
                </div>
                
                <p className="text-[11px] text-stone-300 leading-relaxed font-sans">
                  Set your parameters and enter your private, voice-guided yoga sanctuary. PranaAI is live.
                </p>

                {/* Input block inside launcher card */}
                <div className="space-y-3 pt-1 text-xs">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Practice Style</label>
                    <select 
                      value={practiceType} 
                      onChange={(e) => setPracticeType(e.target.value)}
                      className="w-full bg-[#0a0d0d] border border-white/10 text-stone-200 py-2 px-3 rounded-xl focus:border-emerald-500 outline-none transition-colors cursor-pointer text-xs"
                    >
                      <option value="Power Vinyasa Flow">Power Vinyasa Flow (Fluid posture transitions)</option>
                      <option value="Gentle Hatha Align">Gentle Hatha Align (Slow deep-hold correction)</option>
                      <option value="Yin Restorative Stretch">Yin Restorative Stretch (Slow tissue release)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Duration</label>
                      <select 
                        value={practiceDuration} 
                        onChange={(e) => setPracticeDuration(e.target.value)}
                        className="w-full bg-[#0a0d0d] border border-white/10 text-stone-200 py-2 px-3 rounded-xl focus:border-emerald-500 outline-none transition-colors cursor-pointer text-xs"
                      >
                        <option value="10 Minutes">10 Minutes</option>
                        <option value="20 Minutes">20 Minutes</option>
                        <option value="30 Minutes">30 Minutes</option>
                        <option value="45 Minutes">45 Minutes</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Background Synth</label>
                      <button
                        type="button"
                        onClick={() => setAmbientMusicEnabled(!ambientMusicEnabled)}
                        className={`w-full py-2 px-2.5 rounded-xl text-center border font-semibold tracking-wider transition-all duration-200 text-[10px] ${
                          ambientMusicEnabled 
                            ? "bg-[#10b981]/20 border-[#10b981] text-emerald-300"
                            : "bg-[#0a0d0d] border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10"
                        }`}
                      >
                        {ambientMusicEnabled ? "🔊 Ambient On" : "🔇 Music Off"}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={connectYogaSession}
                  disabled={isConnecting}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 font-semibold text-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#10b981]/15 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-black" />
                      Begin Practice Flow
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* --- TAB CONTENT: ACTIVE PRACTICE ROOM --- */}
          {currentTab === "practice" && (
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {/* --- UPPER 2/3 LIVE CAMERA CONTAINER --- */}
              <div id="camera-viewport" className="relative flex-1 bg-[#14221C] overflow-hidden group">
                {/* The Live Video Element - Mirrored horizontally for user intuitive practice */}
                <video
                  ref={videoRef}
                  id="camera-feed"
                  style={{ transform: "scaleX(-1)" }}
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                  playsInline
                  muted
                  autoPlay
                />

                {/* Calming visual backdrop when camera is offline (Frosted Dark Green Gradient) */}
                {!isActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-[#0C1210] to-[#14221C] text-stone-200 z-10 transition-opacity duration-500">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-105 duration-300 border border-white/10 shadow-sm">
                      <Compass className="w-8 h-8 text-[#10b981] animate-spin" style={{ animationDuration: '40s' }} />
                    </div>
                    <h3 className="text-xl font-light tracking-tight text-white font-serif">PranaAI Yoga Flow</h3>
                    <p className="text-[10px] text-stone-400 max-w-[280px] mt-1.5 leading-relaxed font-sans">
                      The AI instructor will welcome you, watch your postures, and speak real-time breathing adjustments.
                    </p>

                    {/* SELECT YOGA FLOW TYPE AND DURATION FORM */}
                    <div className="w-full mt-4 max-w-sm px-2 text-left space-y-3 font-sans text-xs">
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-emerald-400 font-bold mb-1.5">Select Yoga Practice</label>
                        <select 
                          value={practiceType} 
                          onChange={(e) => {
                            setPracticeType(e.target.value);
                            addLog(`Practice focus set to: ${e.target.value}`);
                          }}
                          className="w-full bg-white/5 border border-white/10 text-stone-200 py-1.5 px-2.5 rounded-xl focus:border-emerald-500 outline-none transition-colors cursor-pointer text-[11px]"
                        >
                          <option value="Power Vinyasa Flow" className="bg-stone-900 text-stone-200">Power Vinyasa Flow (Fluid posture transitions)</option>
                          <option value="Gentle Hatha Align" className="bg-stone-900 text-stone-200">Gentle Hatha Align (Slow deep-hold correction)</option>
                          <option value="Yin Restorative Stretch" className="bg-stone-900 text-stone-200">Yin Restorative Stretch (Slow tissue release)</option>
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase tracking-wider text-emerald-400 font-bold mb-1.5">Session Duration</label>
                          <select 
                            value={practiceDuration} 
                            onChange={(e) => {
                              setPracticeDuration(e.target.value);
                              addLog(`Duration set to: ${e.target.value}`);
                            }}
                            className="w-full bg-white/5 border border-white/10 text-stone-200 py-1.5 px-2.5 rounded-xl focus:border-emerald-500 outline-none transition-colors cursor-pointer text-[11px]"
                          >
                            <option value="10 Minutes" className="bg-stone-900 text-stone-200">10 Minutes</option>
                            <option value="20 Minutes" className="bg-stone-900 text-stone-200">20 Minutes</option>
                            <option value="30 Minutes" className="bg-stone-900 text-stone-200">30 Minutes</option>
                            <option value="45 Minutes" className="bg-stone-900 text-stone-200">45 Minutes</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-[9px] uppercase tracking-wider text-emerald-400 font-bold mb-1.5">Background Music</label>
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !ambientMusicEnabled;
                              setAmbientMusicEnabled(nextState);
                              addLog(`Meditation Ambience toggled: ${nextState ? "ENABLED" : "DISABLED"}`);
                            }}
                            className={`w-full py-1.5 px-2 rounded-xl text-center border font-semibold tracking-wider transition-all duration-200 text-[10px] ${
                              ambientMusicEnabled 
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                                : "bg-white/5 border-white/10 text-stone-400 hover:text-stone-200 hover:bg-white/10"
                            }`}
                          >
                            {ambientMusicEnabled ? "🔊 Ambient: ON" : "🔇 Music Off"}
                          </button>
                        </div>
                      </div>
                      
                      {ambientMusicEnabled && (
                        <div className="flex items-center gap-1.5 pt-1 transition-all">
                          <span className="text-[8px] text-stone-400 uppercase tracking-widest shrink-0">Vibe Vol:</span>
                          <input 
                            type="range" 
                            min="0" 
                            max="0.25" 
                            step="0.01" 
                            value={ambientMusicVolume} 
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setAmbientMusicVolume(val);
                              musicEngineRef.current?.setVolume(val);
                            }} 
                            className="flex-1 accent-emerald-500 h-1 rounded-lg cursor-pointer bg-white/10"
                          />
                        </div>
                      )}
                    </div>

                    {/* Sandbox Permissions Alert with Dark styling */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl text-[10px] gap-2 font-sans shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>Camera blocked? Click <strong>Open in New Tab</strong> above!</span>
                    </div>
                  </div>
                )}

                {/* Live Camera Grid lines & tracking overlay decorations (Simulated Vision HUD) */}
                {isActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10 font-sans">
                    {/* Natural Tones Grid overlay and guides */}
                    <div className="absolute inset-0 border-[32px] border-black/40 transition-all duration-500 pointer-events-none" />
                    <div className="absolute inset-4 border border-[#10b981]/15 rounded-2xl flex items-center justify-center">
                      <div className="w-full h-px bg-[#10b981]/10 absolute top-1/2 left-0" />
                      <div className="h-full w-px bg-[#10b981]/10 absolute left-1/2 top-0" />
                      {/* Visual central align ring */}
                      <div className="w-36 h-36 border border-dashed border-[#10b981]/25 rounded-full animate-pulse" />
                    </div>

                    {/* Status Header Overlay inside camera */}
                    <div className="flex items-center justify-between z-10 w-full relative">
                      <div className="px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-md shadow-sm text-[#10b981] tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                        <span>LIVE OBSERVATION</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-[11px] text-white font-[#10b981] backdrop-blur-md flex items-center gap-1 shadow-sm">
                        <span className="font-sans text-[10px] uppercase opacity-60 tracking-wider">Form:</span>
                        <span className="text-[#10b981] font-semibold">{alignmentStatus}</span>
                      </div>
                    </div>

                    {/* Interactive Audio Wave visualization representing microphone stream */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 animate-pulse z-10 font-sans">
                      <Volume2 className="w-4 h-4 text-[#10b981]" />
                      <div className="flex items-end gap-0.5 h-5 px-1.5 py-1 bg-black/75 border border-white/10 rounded-md backdrop-blur-md shadow-sm">
                        <div className={`w-0.5 bg-[#10b981] transition-all duration-150 ${isUserSpeaking ? "h-3.5" : "h-1.5 animate-bounce"}`} style={{ animationDelay: "100ms" }} />
                        <div className={`w-0.5 bg-[#10b981] transition-all duration-150 ${isUserSpeaking ? "h-2.5" : "h-2 animate-bounce"}`} style={{ animationDelay: "300ms" }} />
                        <div className={`w-0.5 bg-[#10b981] transition-all duration-150 ${isUserSpeaking ? "h-4" : "h-1 animate-bounce"}`} style={{ animationDelay: "200ms" }} />
                        <div className={`w-0.5 bg-[#10b981] transition-all duration-150 ${isUserSpeaking ? "h-3" : "h-1.5 animate-bounce"}`} style={{ animationDelay: "400ms" }} />
                      </div>
                      {isUserSpeaking && (
                        <span className="text-[9px] font-bold text-amber-200 font-sans uppercase tracking-wider bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-md backdrop-blur shadow-sm font-sans">SPEAKING (DUCKED)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* --- LOWER 1/3 FLOATING HUD --- */}
              <div id="floating-hud" className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3 min-h-[35%] justify-end pointer-events-none z-20">
                {/* Frosted Glass Overlay HUD Container with EXACT styles requested */}
                <div 
                  style={{
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "24px",
                  }}
                  className="w-auto m-[12px] p-[20px] flex flex-col gap-3 pointer-events-auto shadow-2xl"
                >
                  {/* Upper row: Breathing state indicator ring and quick metadata info */}
                  <div className="flex items-center gap-3 font-sans">
                    {/* Neon Breathing Ring and status indicator styled in Neon Emerald theme */}
                    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                      <span className="absolute w-full h-full rounded-full border border-white/10" />
                      <span 
                        id="breathing-glow"
                        className={`absolute rounded-full border transition-all duration-[4500ms] ease-in-out ${
                          wsStatus === "connected"
                            ? breathPhase === "Inhale"
                              ? "w-11 h-11 border-[#10b981]/80 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                              : "w-8 h-8 border-[#10b981]/50 scale-100 drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                            : "w-9 h-9 border-white/10 opacity-35 animate-pulse"
                        }`} 
                      />
                      <span className={`w-2.5 h-2.5 rounded-full transition-transform duration-[4500ms] ${wsStatus === "connected" ? "bg-[#10b981]" : "bg-stone-500"}`} />
                    </div>

                    {/* Transcript Metadata info column */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] uppercase tracking-[0.25em] font-semibold text-[#10b981] flex items-center gap-1.5 leading-none">
                        <Sparkles className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                        <span>Yoga Mentor {voiceProfile}</span>
                        {wsStatus === "connected" && <span className="text-[8px] font-normal lowercase italic text-[#10b981]">coaching</span>}
                      </div>
                      <div className="text-xs font-semibold text-white font-sans truncate mt-1">
                        {wsStatus === "connected" ? `${practiceType} — ${practiceDuration}` : "Prana Yoga Flow Studio"}
                      </div>
                    </div>
                  </div>

                  {/* Core Instruction Scroll Panel displaying the teacher's transcripts */}
                  <div 
                    id="instructor-hud-panel"
                    className={`w-full min-h-[72px] max-h-[110px] overflow-y-auto px-4 py-3 bg-black/40 border border-white/10 rounded-2xl flex flex-col justify-center transition-all duration-300 ${
                      hasNewTranscript ? "border-[#10b981]/30 bg-black/60" : ""
                    }`}
                  >
                    <p className="text-stone-100 text-[13px] leading-relaxed font-serif text-center transition-opacity duration-300">
                      "{instructorText}"
                    </p>
                    {wsStatus === "connected" && (
                      <span className="font-sans text-[8px] uppercase tracking-[0.3em] text-stone-400 opacity-60 text-center mt-2 block">Instructor Feedback</span>
                    )}
                  </div>

                  {/* Micro Quick actions bar inside frosted pane */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[9px] text-stone-300 font-sans uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 text-[#10b981]" /> Voice: {voiceProfile}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5 text-[#10b981]" /> Breathe: <strong className="text-[#10b981]">{breathPhase}</strong>
                    </span>
                  </div>
                </div>

                {/* Core Interactive Session Action Buttons - Configured to fit the Natural Tones aesthetic */}
                <div className="w-full flex items-center gap-3 pointer-events-auto shrink-0 z-30 font-sans px-[12px]">
                  {wsStatus !== "connected" ? (
                    <button
                      id="btn-practice-start"
                      onClick={connectYogaSession}
                      disabled={isConnecting}
                      className="flex-1 py-3.5 px-6 rounded-full bg-[#10b981] hover:bg-[#10b981]/90 font-semibold text-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#10b981]/15 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isConnecting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current text-black" />
                          Begin Practice
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      id="btn-practice-stop"
                      onClick={disconnectSession}
                      className="flex-1 py-3.5 px-6 rounded-full bg-white border border-[#10b981]/25 hover:bg-stone-100 text-black font-semibold text-xs uppercase tracking-[0.2em] shadow-sm active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current text-black" />
                      Complete & Log Session
                    </button>
                  )}

                  {/* Quick logs tray toggle or state checker with info */}
                  <button
                    onClick={() => setShowLogsTray(!showLogsTray)}
                    className={`p-3.5 rounded-full border transition-all duration-200 cursor-pointer ${
                      showLogsTray 
                        ? "bg-[#10b981] border-[#10b981]/20 text-black shadow-md shadow-[#10b981]/10" 
                        : "bg-[#0F1414]/80 border-[#2C3E37]/45 text-stone-200 hover:bg-stone-800"
                    }`}
                    title="Show Debug Live Diagnostics Logs"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB CONTENT: YOGA JOURNAL LOGS --- */}
          {currentTab === "journal" && (
            <div id="tab-journal" className="flex-1 overflow-y-auto px-5 py-6 space-y-5 scrollbar-none font-sans">
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-[0.25em] font-medium text-emerald-400 block">PRACTICE REGISTRY</span>
                  <h2 className="text-xl font-light text-white font-serif">Yoga Journal Log</h2>
                </div>
                
                {journalLogs.length > 0 && (
                  <button
                    onClick={() => {
                      if(window.confirm("Clear all logged sessions?")) {
                        setJournalLogs([]);
                        localStorage.removeItem("prana_journal");
                        addLog("Journal logs cleared by user.");
                      }
                    }}
                    className="p-2 text-stone-500 hover:text-red-400 transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Clear list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* MANUAL NOTE ADD FORM */}
              <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }} className="rounded-2xl p-4 space-y-3 text-xs">
                <h4 className="text-[10px] font-bold text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Log Manual Mat Session</span>
                </h4>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      const form = e.currentTarget;
                      const styleInput = form.elements.namedItem("form_style") as HTMLSelectElement;
                      const durationInput = form.elements.namedItem("form_duration") as HTMLSelectElement;
                      const notesInput = form.elements.namedItem("form_notes") as HTMLInputElement;
                      
                      const durationVal = durationInput.value;
                      const styleVal = styleInput.value;
                      const notesVal = notesInput.value || "Offline mat meditation.";

                      const newLogItem = {
                        id: String(Date.now()),
                        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                        type: styleVal,
                        duration: `${durationVal} Mins`,
                        instructor: "Self Directed",
                        rating: "⭐️⭐️⭐️⭐️⭐️",
                        notes: notesVal
                      };

                      const updatedLogs = [newLogItem, ...journalLogs];
                      setJournalLogs(updatedLogs);
                      localStorage.setItem("prana_journal", JSON.stringify(updatedLogs));

                      // Update metrics
                      const addedMin = Number(durationVal);
                      const renewedExp = totalMinutes + addedMin;
                      setTotalMinutes(renewedExp);
                      localStorage.setItem("prana_minutes", String(renewedExp));

                      form.reset();
                      addLog(`Manual practice logged: +${addedMin} mins`, "success");
                    } catch (err: any) {
                      addLog(`Failed to log manual hold: ${err.message}`, "error");
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <select name="form_style" className="w-full bg-[#0a0d0d] border border-white/10 text-stone-200 py-1.5 px-2 rounded-xl cursor-copy text-[11px] outline-none">
                        <option value="Hatha Align">Hatha-Hatha Align</option>
                        <option value="Power Flow">Power Flow (Vinyasa)</option>
                        <option value="Lotus Meditation">Lotus Meditation</option>
                        <option value="Yin Restorative Stretch">Yin Stretch</option>
                      </select>
                    </div>
                    <div>
                      <select name="form_duration" className="w-full bg-[#0a0d0d] border border-white/10 text-stone-200 py-1.5 px-2 rounded-xl cursor-copy text-[11px] outline-none">
                        <option value="10">10 Minutes</option>
                        <option value="15">15 Minutes</option>
                        <option value="20">20 Minutes</option>
                        <option value="30">30 Minutes</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      name="form_notes" 
                      type="text" 
                      placeholder="Add personal notes (e.g. alignment stretch)" 
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] placeholder:text-stone-600 outline-none focus:border-[#10b981]/50 text-stone-200"
                    />
                    <button type="submit" className="bg-[#10b981] text-black hover:bg-[#10b981]/90 rounded-xl px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wide cursor-pointer">
                      Log
                    </button>
                  </div>
                </form>
              </div>

              {/* LIST OF LOGS */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Completed Sessions Logs</h4>
                
                {journalLogs.length === 0 ? (
                  <div className="text-stone-600 text-center py-8 text-[11px]">No logged sessions. Start practiced feeds to begin tracking!</div>
                ) : (
                  <div className="space-y-3.5">
                    {journalLogs.map((log) => (
                      <div 
                        key={log.id} 
                        style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.05)" }}
                        className="rounded-2xl p-4 relative group"
                      >
                        <button
                          onClick={() => {
                            const remainsVal = journalLogs.filter((j) => j.id !== log.id);
                            setJournalLogs(remainsVal);
                            localStorage.setItem("prana_journal", JSON.stringify(remainsVal));
                            addLog(`Deleted journal log entry: ${log.type}`);
                          }}
                          className="absolute right-3 top-3.5 text-stone-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 cursor-pointer p-1"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        <div className="flex items-center justify-between text-[10px] text-stone-400">
                          <span className="font-mono text-[9px] tracking-wider uppercase">{log.date}</span>
                          <span className="text-emerald-400 font-semibold">{log.duration}</span>
                        </div>
                        
                        <h5 className="text-[13px] font-semibold text-white mt-1">{log.type}</h5>
                        <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">"{log.notes}"</p>
                        
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-[9px] text-stone-500 uppercase tracking-wider">
                          <span>Instructor: <strong className="text-stone-300">{log.instructor}</strong></span>
                          <span>Rating: <strong className="text-amber-400">{log.rating}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Dynamic Bottom Tab Bar Navigation (Hidden while actively connected to focus the user) */}
          {wsStatus !== "connected" && (
            <div className="bg-[#0A0D0D] border-t border-white/5 py-3 px-4 flex items-center justify-around shrink-0 z-20 font-sans text-[10px] font-medium text-stone-400">
              <button 
                onClick={() => setCurrentTab("dashboard")}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${currentTab === "dashboard" ? "text-[#10b981]" : "hover:text-stone-200"}`}
              >
                <Compass className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button 
                onClick={() => {
                  setCurrentTab("practice");
                  addLog("Navigated to Practice Sanctuary viewport.");
                }}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${currentTab === "practice" ? "text-[#10b981]" : "hover:text-stone-200"}`}
              >
                <Activity className="w-4 h-4" />
                <span>Practice Room</span>
              </button>
              <button 
                onClick={() => setCurrentTab("journal")}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${currentTab === "journal" ? "text-[#10b981]" : "hover:text-stone-200"}`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Journal</span>
              </button>
            </div>
          )}

        </div>

        {/* --- DESKTOP HIGH POLISH CAMERA MIRROR MONITOR DASHBOARD PANEL --- */}
        <div className="hidden lg:flex flex-col w-96 bg-[#0E1211] border border-white/10 rounded-[32px] p-6 shadow-2xl text-stone-200 self-stretch justify-between font-sans relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            {/* Title block */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-white uppercase">AI Vision Monitor</h3>
                <p className="text-[10px] text-stone-400">Low-latency observer feedback pipeline</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono tracking-widest ${isActive ? "bg-[#10b981]/15 text-[#10b981] animate-pulse" : "bg-white/5 text-stone-500"}`}>
                {isActive ? "ACTIVE STREAM" : "OFFLINE"}
              </span>
            </div>

            {/* Main Mirror Viewfinder Frame */}
            <div className="relative aspect-video rounded-2xl bg-stone-900 border border-white/5 overflow-hidden flex items-center justify-center group mb-4 shadow-inner">
              {isActive ? (
                <>
                  {/* Mirror video preview representation */}
                  <div className="absolute inset-0 bg-[#0C1210]/95 flex items-center justify-center">
                    <Compass className="w-12 h-12 text-[#10b981]/10 animate-spin" style={{ animationDuration: '60s' }} />
                  </div>
                  
                  {/* Dynamic absolute canvas tracking elements */}
                  <div className="absolute inset-4 border border-[#10b981]/10 rounded-xl border-dashed pointer-events-none flex items-center justify-center">
                    <div className="w-12 h-12 border border-[#10b981]/25 rounded-full animate-ping" />
                  </div>

                  {/* Real mirrored feed directly inside self review panel */}
                  <video
                    id="desktop-mirror-preview"
                    style={{ transform: "scaleX(-1)" }}
                    className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-90 border border-emerald-500/20"
                    playsInline
                    muted
                    autoPlay
                    ref={(el) => {
                      // Point desktop video to same media stream if active
                      if (el && cameraMediaStreamRef.current && el.srcObject !== cameraMediaStreamRef.current) {
                        el.srcObject = cameraMediaStreamRef.current;
                        el.play().catch(e => {});
                      }
                    }}
                  />
                  
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded-md text-[9px] text-stone-300 font-mono flex items-center gap-1.5 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> 
                    AI Capture Mirror
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <Camera className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                  <p className="text-xs text-stone-500">Camera Feed Uninitialized</p>
                  <p className="text-[10px] text-stone-600 mt-1 max-w-[200px] leading-relaxed mx-auto">Connect session to mirror your active camera and calibrate joints.</p>
                </div>
              )}
            </div>

            {/* Meta data list */}
            <div className="space-y-3 text-xs bg-white/5 p-4 rounded-2xl border border-white/5">
              <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Observation Diagnostics</h4>
              
              <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1.5">
                <span className="text-stone-400">Practice focus:</span>
                <span className="text-[#10b981] font-semibold">{practiceType}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1.5">
                <span className="text-stone-400">Target Pose State:</span>
                <span className="text-white font-medium">{isActive ? alignmentStatus : "Idle"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1.5">
                <span className="text-stone-400">Video Frame Rate:</span>
                <span className="text-white font-mono text-[10px]">{isActive ? "1 frame / 1.2 sec" : "0.00"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400">Compress payload:</span>
                <span className="text-white font-mono text-[10px]">{isActive ? "320x240 JPEG 0.5x" : "None"}</span>
              </div>
            </div>
          </div>

          {/* Calibration Helper */}
          <div className="bg-[#10b981]/5 rounded-2xl border border-[#10b981]/10 p-3.5 text-[11px] text-stone-300 leading-relaxed shrink-0">
            <div className="flex items-center gap-1.5 text-[#10b981] font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#10b981]" /> Alignment Checklist:
            </div>
            <div>• Slide 6-8 feet away to show feet & shoulders</div>
            <div>• Keep camera standard lens height</div>
            <div>• Ask questions mid-pose anytime to adjust holds!</div>
          </div>
        </div>

      </div>

      {/* Connection & Deep Handshake Diagnostics log viewer overlay drawer (Paper Dark Aesthetic) */}
      {showLogsTray && (
        <div className="w-full max-w-2xl mt-4 bg-[#0E1211] border border-white/10 rounded-3xl p-5 text-xs font-sans shadow-2xl animate-in fade-in duration-300 z-10 text-stone-200">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <h4 className="font-bold flex items-center gap-1.5 tracking-wide text-xs text-white">
              <Activity className="w-3.5 h-3.5 text-[#10b981] animate-pulse" /> Handshake Handlers & Diagnostics
            </h4>
            <span className="text-[10px] text-stone-400 uppercase tracking-widest font-sans">Live API Stream logs</span>
          </div>

          {/* Quick config selections */}
          <div className="grid grid-cols-2 gap-3 mb-4 bg-white/5 p-3 rounded-2xl border border-white/5 text-[11px]">
            <div>
              <label className="text-[9px] block text-emerald-400 uppercase tracking-wider font-bold mb-1">Model Target Core</label>
              <select 
                value={modelType} 
                onChange={(e) => setModelType(e.target.value)}
                disabled={isActive}
                className="bg-stone-900 border border-white/10 text-stone-200 outline-none w-full py-1.5 px-2.5 rounded-xl cursor-pointer text-xs focus:border-[#10b981] transition-colors"
              >
                <option value="gemini-2.5-flash">models/gemini-2.5-flash</option>
                <option value="gemini-3.1-flash-live-preview">models/gemini-3.1-flash-live-preview</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] block text-emerald-400 uppercase tracking-wider font-bold mb-1">Instructor Voice Name</label>
              <select 
                value={voiceProfile} 
                onChange={(e) => setVoiceProfile(e.target.value)}
                disabled={isActive}
                className="bg-stone-900 border border-white/10 text-stone-200 outline-none w-full py-1.5 px-2.5 rounded-xl cursor-pointer text-xs focus:border-[#10b981] transition-colors"
              >
                <option value="Puck">Instructor "Puck" (soothing)</option>
                <option value="Zephyr">Instructor "Zephyr" (calming)</option>
                <option value="Kore">Instructor "Kore" (meditative)</option>
                <option value="Charon">Instructor "Charon" (serene)</option>
              </select>
            </div>
          </div>

          <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] leading-relaxed select-text">
            {logs.length === 0 ? (
              <div className="text-stone-500 text-center py-4 font-sans text-xs">No active stream logs. Click "Begin Practice" to inspect live packets.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2 items-start border-b border-white/5 pb-1 font-mono">
                  <span className="text-stone-500 shrink-0 select-none">[{log.time}]</span>
                  <span className={`${
                    log.type === "success" ? "text-emerald-400 font-medium" :
                    log.type === "warning" ? "text-amber-300" :
                    log.type === "error" ? "text-red-400 font-bold" :
                    "text-stone-300"
                  }`}>{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating explanatory information widget */}
      <div className="mt-4 text-center max-w-md px-4 z-20">
        <p className="text-[10px] font-sans text-stone-500 tracking-wide uppercase leading-relaxed">
          🧘‍♂️ PranaAI is powered by browser WebSockets connected directly to Gemini Multimodal Live API. All camera frames are compressed locally for private, zero-lag diagnostic analysis.
        </p>
      </div>

    </div>
  );
}
