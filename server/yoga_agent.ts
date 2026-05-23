/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Yoga Flow Agent - Live API Handshake and Streaming Utility
 * 
 * This file handles WebSocket interactions with the Gemini Live API.
 * It manages the connection lifecycle, audio/video data piping, and
 * log checkpoints for tracking performance in real-time.
 */

import { GoogleGenAI } from "@google/genai";
import { WebSocket } from "ws";

// Initialize the server-side Gemini client
// Note: User-Agent is set to 'aistudio-build' for AI Studio metrics compliance.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

/**
 * Safely extracts a human-readable message from a potential error object.
 * Prevents serialization of heavy or circular internal Node.js Socket/WebSocket structures
 * that contain internal state attributes like _hadError, _errored, or onerror functions.
 */
function safeExtractErrorMessage(err: any): string {
  if (!err) {
    return "Unknown stream connection error";
  }

  // Handle standard string error
  if (typeof err === "string") {
    return err;
  }

  // Try to extract message standard properties
  if (err instanceof Error) {
    return err.message;
  }

  // If err has message as a string
  if (err.message && typeof err.message === "string") {
    return err.message;
  }

  // Check if error is nested in the object (e.g. err.error)
  if (err.error) {
    if (err.error instanceof Error) {
      return err.error.message;
    }
    if (typeof err.error === "string") {
      return err.error;
    }
    if (typeof err.error === "object" && err.error.message && typeof err.error.message === "string") {
      return err.error.message;
    }
  }

  // Detect internal Socket/Connection structures to avoid dumping them
  try {
    const keys = Object.keys(err);
    if (
      keys.includes("_hadError") || 
      keys.includes("_errored") || 
      keys.includes("_errorEmitted") || 
      keys.includes("onerror") || 
      keys.includes("authorizationError")
    ) {
      if (err.authorizationError && typeof err.authorizationError === "string") {
        return `Authorization failed: ${err.authorizationError}`;
      }
      return "Gemini Live API stream closed or failed to authorize";
    }
  } catch (e) {
    // ignore
  }

  // Fallback to safe stringification
  try {
    const str = String(err);
    if (str === "[object Object]") {
      return "Gemini Live API connection refused or aborted";
    }
    return str;
  } catch (e) {
    return "Gemini Live API encountered a communication boundary error";
  }
}

interface CreateYogaAgentSessionOptions {
  clientWs: WebSocket;
  modelName?: string;
  systemInstruction?: string;
  voiceName?: string;
}

/**
 * Connects the active client websocket stream to a new Gemini Multimodal Live session.
 * Pipes client microphone packets and video frame bytes to Gemini, and
 * returns synthesized audio bytes and transcripts back to the client.
 */
export async function createYogaAgentSession({
  clientWs,
  modelName = "gemini-2.5-flash",
  systemInstruction = "You are an elite, highly encouraging Vinyasa Yoga Instructor. Your job is to watch the user's camera stream, listen to their live spoken questions, and provide immediate conversational guidance.\n\nLive Interaction Protocol: If the user speaks or asks a question mid-pose (e.g., 'Am I doing this right?', 'Where should my foot be?', or 'I feel off balance'), you must immediately abort your current general routine instruction, evaluate their active camera frame, and answer their question directly based on their real-world posture alignment.\n\nPacing & Silence Safeguards: Guide the flow step-by-step. Deliver exactly one posture instruction at a time. After delivering an instruction, state 'Holding here for three deep breaths...' and stop talking entirely. Let the user hold the pose in peace unless their posture breaks.\n\nCorrection Boundaries: Keep all spoken answers shorter than 15 words. Yoga demands focus. If the user wobbles, remind them to find a steady focal point. If their front knee tracks past their ankle in lunges, tell them to slide their foot forward to protect the joint. If their shoulders are hunched, tell them to roll their shoulders down away from their ears.",
  voiceName = "Puck"
}: CreateYogaAgentSessionOptions) {
  
  console.log(`[YogaAgent] Initiating live handshake with Gemini model: ${modelName}`);
  
  if (!process.env.GEMINI_API_KEY) {
    const errMsg = "GEMINI_API_KEY is not defined in the server environment.";
    console.error(`[YogaAgent] Error: ${errMsg}`);
    clientWs.send(JSON.stringify({ type: "error", error: errMsg }));
    return;
  }

  let session: any = null;

  try {
    // Setup the bidirectional live connection
    session = await ai.live.connect({
      model: modelName,
      callbacks: {
        onopen: () => {
          console.log("[YogaAgent] Handshake with Gemini Live WebSocket established successfully.");
          clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
        },
        onclose: (event: any) => {
          console.log("[YogaAgent] Gemini Live connection closed:", event);
          clientWs.send(JSON.stringify({ type: "status", status: "disconnected" }));
        },
        onerror: (err: any) => {
          const errMessage = safeExtractErrorMessage(err);
          console.error("[YogaAgent] Gemini Live WebSocket error:", errMessage);
          clientWs.send(JSON.stringify({ type: "error", error: errMessage }));
        },
        onmessage: (message: any) => {
          // Parse server messages containing audio buffers and transcripts
          const parts = message.serverContent?.modelTurn?.parts;
          
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                const audioBase64 = part.inlineData.data;
                console.log(`[YogaAgent] Dispatched output audio chunk (${audioBase64.length} chars base64) to client`);
                clientWs.send(JSON.stringify({ type: "audio", data: audioBase64 }));
              }
              if (part.text) {
                console.log(`[YogaAgent] Detected transcription chunk: "${part.text}"`);
                clientWs.send(JSON.stringify({ type: "text", text: part.text }));
              }
            }
          }

          // Handle audio transcription from metadata if available separately
          if (message.outputTranscription) {
            console.log(`[YogaAgent] outputTranscription metadata discovered:`, message.outputTranscription);
            clientWs.send(JSON.stringify({ type: "text", text: message.outputTranscription.text }));
          }

          // Handle interruption events (barge-in support)
          if (message.serverContent?.interrupted) {
            console.log("[YogaAgent] Turn interrupted by user barge-in.");
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          }
        },
      },
      config: {
        responseModalities: ["AUDIO"],
        systemInstruction,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
        // Request visual and audio transcriptions in output
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      } as any,
    });
  } catch (error: any) {
    const errMessage = safeExtractErrorMessage(error);
    console.error("[YogaAgent] Failed to establish Gemini Live connection:", errMessage);
    clientWs.send(JSON.stringify({ type: "error", error: `Handshake failed: ${errMessage}` }));
    return;
  }

  // Handle messages arriving FROM the browser client
  clientWs.on("message", async (msgBuffer) => {
    try {
      const message = JSON.parse(msgBuffer.toString());

      if (message.type === "audio" && message.data) {
        // Stream raw base64 PCM chunk straight to Gemini session
        // Checkpoint log: tracking audio packet dispatches
        // console.log(`[YogaAgent] Dispatching ${message.data.length} bytes of microphone PCM audio`);
        await session.sendRealtimeInput({
          audio: {
            data: message.data,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      }

      else if (message.type === "video" && message.data) {
        // Send base64 JPEG from active camera directly to Gemini session
        // Checkpoint log: tracking camera frame dispatches
        // console.log(`[YogaAgent] Dispatching camera frame image (${message.data.length} bytes base64)`);
        await session.sendRealtimeInput({
          video: {
            data: message.data,
            mimeType: "image/jpeg",
          },
        });
      }

      else if (message.type === "ping") {
        clientWs.send(JSON.stringify({ type: "pong" }));
      }
    } catch (parseErr: any) {
      console.warn("[YogaAgent] Error processing message from client:", parseErr.message);
    }
  });

  clientWs.on("close", () => {
    console.log("[YogaAgent] Client disconnection. Closing Gemini Live WebSocket session...");
    try {
      if (session) {
        session.close();
      }
    } catch (err) {
      console.error("[YogaAgent] Error closing Gemini Live session:", err);
    }
  });
}
