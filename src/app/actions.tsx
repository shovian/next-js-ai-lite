'use server';

import { createStreamableValue, createStreamableUI } from 'ai/rsc';
import { CoreMessage } from 'ai';
import { Weather } from '@/components/weather';
import { ReactNode } from 'react';
import { z } from 'zod';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: ReactNode;
}

/**
 * Streaming Chat using Ollama.
 * This function streams text from Ollama (using TinyLlama) based on the incoming messages.
 * After reading the response stream, it calls `.done()` to finalize and get a plain string.
 */
export async function continueTextConversation(messages: CoreMessage[]) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt: messages.map(msg => msg.content).join("\n"),
      stream: true,
    }),
  });

  // Get the underlying stream reader from the response body.
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response stream available.");
  }
  
  // Create a streamable value from the reader.
  const stream = createStreamableValue(reader);
  // Call .done() to finish streaming and extract a plain value.
  const finalText = await stream.done(); 
  return finalText;
}

/**
 * Generate UI responses via Ollama.
 * This function uses a streaming UI helper, then finalizes the stream to a plain value before returning.
 */
export async function continueConversation(history: Message[]) {
  const uiStream = createStreamableUI();

  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt: history.map(msg => msg.content).join("\n"),
    }),
  });

  // Parse the final response from Ollama.
  const data = await response.json();

  // Finish the streaming UI and get a plain value.
  const finalDisplay = await uiStream.done();

  return {
    messages: [
      ...history,
      {
        role: "assistant",
        content: data.response,
        display: finalDisplay,
      },
    ],
  };
}

/**
 * Check AI availability.
 * Since Ollama runs locally and no API key is needed, this always returns true.
 */
export async function checkAIAvailability() {
  return true;
}
