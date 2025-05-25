'use server';

import { CoreMessage } from 'ai';
import { createStreamableValue, createStreamableUI } from 'ai/rsc';
import { ReactNode } from 'react';
import { z } from 'zod';
import { Weather } from '@/components/weather';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: ReactNode;
}

/**
 * Helper: Transform the binary response stream into a stream of plain text chunks.
 *
 * Ollama’s TinyLlama streams JSON lines (e.g.,
 *   {"model":"tinyllama", "created_at":"...", "response":" ...", "done":false} ).
 *
 * This function uses the Web Streams API to:
 *   - Decode each Uint8Array chunk.
 *   - Accumulate incomplete lines.
 *   - Split by newline and parse each JSON object.
 *   - Enqueue only the "response" field.
 */
function transformOllamaStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  return body.pipeThrough(
    new TransformStream({
      start(controller) {
        this.buffer = "";
      },
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk, { stream: true });
        this.buffer += text;
        // Split the buffer into lines.
        const lines = this.buffer.split("\n");
        // Save the last partial line back to the buffer.
        this.buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            try {
              const obj = JSON.parse(line);
              // Enqueue the "response" text.
              controller.enqueue(obj.response);
            } catch (e) {
              console.error("JSON parse error:", line, e);
            }
          }
        }
      },
      flush(controller) {
        if (this.buffer.trim()) {
          try {
            const obj = JSON.parse(this.buffer);
            controller.enqueue(obj.response);
          } catch (e) {
            console.error("JSON parse error during flush:", this.buffer, e);
          }
        }
      }
    })
  );
}

/**
 * Streaming Chat using Ollama (TinyLlama).
 *
 * Sends the prompt and returns a streamable value created via `createStreamableValue`
 * that the client hook (e.g. `readStreamableValue`) can consume.
 */
export async function continueTextConversation(messages: CoreMessage[]) {
  const prompt = messages.map(msg => msg.content).join("\n");
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt,
      stream: true,
    }),
  });

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  // Transform the binary stream into a stream of plain text chunks.
  const transformedStream = transformOllamaStream(response.body);
  // Wrap the transformed stream with createStreamableValue so that it is compatible with readStreamableValue.
  const streamable = createStreamableValue(transformedStream.getReader());
  return streamable.value;
}

/**
 * Generate UI responses via Ollama.
 *
 * Similar to continueTextConversation but using createStreamableUI.
 * The function returns a plain object containing updated messages.
 */
export async function continueConversation(history: Message[]) {
  const prompt = history.map(msg => msg.content).join("\n");
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt,
      stream: true,
    }),
  });

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  const transformedStream = transformOllamaStream(response.body);
  // Use createStreamableUI for UI-specific streaming.
  const streamable = createStreamableUI(transformedStream.getReader());
  // Wait until the stream completes; the UI stream should now be a plain text value.
  const finalDisplay = await streamable.done();

  // Return an updated messages object.
  const updated = {
    messages: [
      ...history,
      {
        role: "assistant",
        content: finalDisplay, // Plain text response.
        display: finalDisplay, // Using plain text for display.
      },
    ],
  };

  // Deep-serialize to force plain objects.
  return JSON.parse(JSON.stringify(updated));
}

/**
 * Check AI Availability.
 *
 * Since Ollama runs locally without requiring an API key, this always returns true.
 */
export async function checkAIAvailability() {
  return true;
}
