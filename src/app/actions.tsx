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
 * This function streams text (using TinyLlama via Ollama) and then finalizes
 * the stream by calling `.done()`, ensuring a plain string is returned.
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

  if (!response.body) {
    throw new Error("Response body is empty");
  }
  const reader = response.body.getReader();

  // Create and finalize the stream to get a plain string value
  const stream = createStreamableValue(reader);
  const finalText = await stream.done();
  return finalText;
}

/**
 * Generate UI responses using Ollama.
 * This function calls the Ollama API with the conversation history, then finalizes
 * the streaming UI value. Before returning, it serializes the display output to ensure
 * that only plain objects are passed to Client Components.
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

  const data = await response.json();

  // Finalize the UI stream and force serialization into a plain object
  const finalDisplay = await uiStream.done();
  const plainDisplay = JSON.parse(JSON.stringify(finalDisplay));

  return {
    messages: [
      ...history,
      {
        role: "assistant",
        content: data.response,
        display: plainDisplay,
      },
    ],
  };
}

/**
 * Check AI availability.
 * Since Ollama runs locally and no API key is required, this always returns true.
 */
export async function checkAIAvailability() {
  return true;
}
