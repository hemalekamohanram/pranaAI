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
  ExternalLink
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

export default function App() {
  // App UI State
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [modelType, setModelType] = useState("gemini-2.5-flash"); // Live API production core
  const [voiceProfile, setVoiceProfile] = useState("Puck"); // puck is required serene yoga cadence
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [formAlert, setFormAlert] = useState<string | null>(null);
  
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
    const wsUrl = `${protocol}//${host}/api/live-yoga?model=${encodeURIComponent(modelType)}&voice=${encodeURIComponent(voiceProfile)}`;
    
    addLog(`Opening Socket connection at URL: ${wsUrl}`, "info");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      setIsConnecting(false);
      setIsActive(true);
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
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupStreams();
    setInstructorText("Yoga flow ended. Take a moment to sit quietly. Press 'Ready to Practice' whenever you are ready to resume.");
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
    <div className="min-h-screen bg-[#F5F5F0] text-[#2C2C24] flex flex-col items-center justify-center p-2 md:p-6 font-serif selection:bg-[#5A5A40]/10 selection:text-[#5A5A40]">
      
      {/* Decorative Natural Tones soft organic atmospheric blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5A5A40]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D9C5B2]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Responsive Web View App Mock Container (Elegant Simulated Smartphone with Premium Dark Bezel) */}
      <div className="w-full max-w-lg bg-[#0F1414] border-4 border-[#2C3E37]/15 rounded-[48px] shadow-2xl shadow-[#2C3E37]/20 overflow-hidden flex flex-col relative aspect-[9/16] md:max-h-[92vh]">
        
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
            <span className="text-stone-500 font-mono text-[10px]">v1.0.2</span>
          </div>
        </div>

        {/* --- UPPER 2/3 LIVE CAMERA CONTAINER --- */}
        <div id="camera-viewport" className="relative flex-1 bg-[#E8E8E1] overflow-hidden group">
          {/* The Live Video Element */}
          <video
            ref={videoRef}
            id="camera-feed"
            className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
            playsInline
            muted
            autoPlay
          />

          {/* Calming visual backdrop when camera is offline (Frosted Dark Green Gradient) */}
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-[#0C1210] to-[#14221C] text-stone-200 z-10 transition-opacity duration-500">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-105 duration-300 border border-white/10 shadow-sm">
                <Compass className="w-8 h-8 text-[#10b981] animate-spin" style={{ animationDuration: '40s' }} />
              </div>
              <h3 className="text-xl font-light tracking-tight text-white font-serif">PranaAI Yoga Flow</h3>
              <p className="text-xs text-stone-400 max-w-[280px] mt-2 leading-relaxed font-sans">
                Connect your camera and mic to start holding custom poses. The AI instructor will listen, watch your alignment, and speak verbal adjustments instantly.
              </p>

              {/* Quick instructions panel inside viewport */}
              <div className="mt-6 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-left text-[11px] text-stone-300 max-w-xs space-y-1.5 hover:bg-white/10 transition-all duration-300 cursor-default shadow-sm font-sans">
                <div className="flex items-center gap-1.5 text-[#10b981] font-bold mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Alignment Tips:
                </div>
                <div>• Step back 6-8 feet to show your full posture.</div>
                <div>• Keep your room well lit with soft, warm light.</div>
                <div>• Listen carefully for alignment guidance notes.</div>
              </div>

              {/* Sandbox Permissions Alert with Dark styling */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center p-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl text-[11px] gap-2 font-sans shadow-sm">
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
                  <span className="text-[9px] font-bold text-amber-200 font-sans uppercase tracking-wider bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-md backdrop-blur shadow-sm">SPEAKING (DUCKED)</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- LOWER 1/3 FLOATING HUD --- */}
        <div id="floating-hud" className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-3 min-h-[35%] justify-end pointer-events-none z-20">
               {/* Frosted Glass Overlay HUD Container with EXACT styles requested */}
          <div 
            style={{
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "24px",
            }}
            className="w-auto m-[16px] p-[24px] flex flex-col gap-3 pointer-events-auto shadow-2xl"
          >
            
            {/* Upper row: Breathing state indicator ring and quick metadata info */}
            <div className="flex items-center gap-3 font-sans">
              
              {/* Neon Breathing Ring and status indicator styled in Neon Emerald theme */}
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                {/* Static indicator base ring */}
                <span className="absolute w-full h-full rounded-full border border-white/10" />
                
                {/* Active Pulsing Sage-Olive Breathing Ring */}
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
                
                {/* Core Yoga Dot */}
                <span className={`w-2.5 h-2.5 rounded-full transition-transform duration-[4500ms] ${wsStatus === "connected" ? "bg-[#10b981]" : "bg-stone-500"}`} />
              </div>

              {/* Transcript Metadata info column */}
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-[0.25em] font-semibold text-stone-300 flex items-center gap-1.5 leading-none">
                  <Sparkles className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  <span>Vinyasa Master Puck</span>
                  {wsStatus === "connected" && <span className="text-[8px] font-normal lowercase italic text-[#10b981]">listening</span>}
                </div>
                <div className="text-xs font-semibold text-white font-sans truncate mt-1">
                  {wsStatus === "connected" ? `Vinyasa Guide — Model: ${modelType.split("-").slice(0,2).join(" ")}` : "Prana Yoga Flow Studio"}
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
              <p className="text-stone-100 text-[14px] leading-relaxed font-serif text-center transition-opacity duration-300">
                "{instructorText}"
              </p>
              {wsStatus === "connected" && (
                <span className="font-sans text-[8px] uppercase tracking-[0.3em] text-stone-400 opacity-60 text-center mt-2 block">Instructor Feedback</span>
              )}
            </div>

            {/* Micro Quick actions bar inside frosted pane */}
            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[9px] text-stone-300 font-sans uppercase tracking-widest">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-[#10b981]" /> HUD Voice: puck
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 text-[#10b981]" /> Breathe: <strong className="text-[#10b981]">{breathPhase}</strong>
              </span>
            </div>
            
          </div>

          {/* Core Interactive Session Action Buttons - Configured to fit the Natural Tones aesthetic */}
          <div className="w-full flex items-center gap-3 pointer-events-auto shrink-0 z-30 font-sans">
            {wsStatus !== "connected" ? (
              <button
                id="btn-practice-start"
                onClick={connectYogaSession}
                disabled={isConnecting}
                className="flex-1 py-3.5 px-6 rounded-full bg-[#5A5A40] hover:bg-[#5A5A40]/90 font-semibold text-white text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#5A5A40]/15 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-white" />
                    Ready to practice
                  </>
                )}
              </button>
            ) : (
              <button
                id="btn-practice-stop"
                onClick={disconnectSession}
                className="flex-1 py-3.5 px-6 rounded-full bg-white border border-[#5A5A40]/25 hover:bg-[#F5F5F0] text-[#5A5A40] font-semibold text-xs uppercase tracking-[0.2em] shadow-sm active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current text-[#5A5A40]" />
                Complete Practice
              </button>
            )}

            {/* Quick logs tray toggle or state checker with info */}
            <button
              onClick={() => setShowLogsTray(!showLogsTray)}
              className={`p-3.5 rounded-full border transition-all duration-200 cursor-pointer ${
                showLogsTray 
                  ? "bg-[#5A5A40] border-[#5A5A40]/20 text-white shadow-md shadow-[#5A5A40]/10" 
                  : "bg-[#E8E8E1]/80 border-[#5A5A40]/15 text-[#5A5A40] hover:bg-white"
              }`}
              title="Show Debug Live Diagnostics Logs"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Connection & Deep Handshake Diagnostics log viewer overlay drawer (Cream / Paper Aesthetic) */}
      {showLogsTray && (
        <div className="w-full max-w-lg mt-4 bg-white border border-[#5A5A40]/15 rounded-3xl p-5 text-xs font-sans shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-3 text-[#5A5A40] border-b border-[#5A5A40]/10 pb-2">
            <h4 className="font-bold font-serif flex items-center gap-1.5 tracking-wide text-xs">
              <Activity className="w-3.5 h-3.5 text-[#5A5A40] animate-pulse" /> Handshake Handlers & Diagnostics
            </h4>
            <span className="text-[10px] text-[#5A5A40]/60 uppercase tracking-widest font-sans">Live API Stream</span>
          </div>

          {/* Quick config selections */}
          <div className="grid grid-cols-2 gap-3 mb-4 bg-[#F5F5F0] p-3 rounded-2xl border border-[#5A5A40]/10 text-[11px]">
            <div>
              <label className="text-[9px] block text-[#5A5A40]/70 uppercase tracking-wider font-bold mb-1">Model Target Core</label>
              <select 
                value={modelType} 
                onChange={(e) => setModelType(e.target.value)}
                disabled={isActive}
                className="bg-white border border-[#5A5A40]/15 text-[#2C2C24] outline-none w-full py-1.5 px-2.5 rounded-xl cursor-pointer text-xs focus:border-[#5A5A40] transition-colors"
              >
                <option value="gemini-2.5-flash">models/gemini-2.5-flash</option>
                <option value="gemini-3.1-flash-live-preview">models/gemini-3.1-flash-live-preview</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] block text-[#5A5A40]/70 uppercase tracking-wider font-bold mb-1">Instructor Voice</label>
              <select 
                value={voiceProfile} 
                onChange={(e) => setVoiceProfile(e.target.value)}
                disabled={isActive}
                className="bg-white border border-[#5A5A40]/15 text-[#2C2C24] outline-none w-full py-1.5 px-2.5 rounded-xl cursor-pointer text-xs focus:border-[#5A5A40] transition-colors"
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
              <div className="text-[#5A5A40]/60 text-center py-4 font-sans text-xs">No active stream logs. Click "Ready to Practice" to inspect live packets.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2 items-start border-b border-[#5A5A40]/5 pb-1">
                  <span className="text-[#5A5A40]/50 shrink-0 select-none">[{log.time}]</span>
                  <span className={`${
                    log.type === "success" ? "text-emerald-700 font-medium" :
                    log.type === "warning" ? "text-[#D97706]" :
                    log.type === "error" ? "text-red-700 font-bold" :
                    "text-[#2C2C24]/85"
                  }`}>{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating explanatory information widget */}
      <div className="mt-4 text-center max-w-sm px-4">
        <p className="text-[10px] font-sans text-[#5A5A40]/70 tracking-wide uppercase leading-relaxed">
          🧘‍♂️ PranaAI is powered by standard browser WebSockets connected directly to Gemini Multimodal Live API. For full visual alignment feedback, hold your posture centered inside the camera grid.
        </p>
      </div>

    </div>
  );
}
