'use server';

import { createStreamableValue } from 'ai/rsc';
import { CoreMessage } from 'ai';
import { Weather } from '@/components/weather';
import { createStreamableUI } from 'ai/rsc';
import { ReactNode } from 'react';
import { z } from 'zod';

// 🔹 Interface for Messages
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: ReactNode;
}

// 🔹 Streaming Chat via Ollama
export async function continueTextConversation(messages: CoreMessage[]) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt: messages.map(msg => msg.content).join("\n"),
      stream: true
    }),
  });

  const reader = response.body?.getReader();
  const stream = createStreamableValue(reader);
  return stream.value;
}

// 🔹 Generate UI Responses via Ollama
export async function continueConversation(history: Message[]) {
  const stream = createStreamableUI();

  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt: history.map(msg => msg.content).join("\n"),
    }),
  });

  const data = await response.json();

  return {
    messages: [
      ...history,
      {
        role: "assistant",
        content: data.response,
        display: stream.value,
      },
    ],
  };
}

// 🔹 Check AI Availability (Always True for Local Ollama)
export async function checkAIAvailability() {
  return true; // Ollama runs locally, no API key needed.
}
