'use server';

import { CoreMessage } from 'ai';
import { ReactNode } from 'react';
import { z } from 'zod';
import { Weather } from '@/components/weather';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: ReactNode;
}

/**
 * Streaming Chat using Ollama (TinyLlama).
 *
 * This function sends the conversation messages to the Ollama server,
 * then processes the stream of JSON lines returned by TinyLlama.
 *
 * Each JSON line looks like:
 *   {"model":"tinyllama","created_at":"TIMESTAMP","response":" some text","done":false}
 *
 * The function extracts the "response" field from each chunk, accumulates them into one plain string,
 * and returns that string.
 */
export async function continueTextConversation(messages: CoreMessage[]): Promise<string> {
  const prompt = messages.map(msg => msg.content).join("\n");
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt,
      stream: true
    }),
  });

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let aggregatedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode the chunk into a string.
    const chunk = decoder.decode(value, { stream: true });

    // The chunk may contain multiple JSON lines. Split by newline.
    const lines = chunk.split("\n").filter(line => line.trim().length > 0);
    for (const line of lines) {
      try {
        // Parse and accumulate only the "response" part.
        const jsonObj = JSON.parse(line);
        aggregatedText += jsonObj.response;
      } catch (err) {
        console.error("Error parsing JSON line:", line, err);
      }
    }
  }

  // Deep serialize to ensure a plain string.
  const plainText = JSON.parse(JSON.stringify(aggregatedText));
  return plainText;
}

/**
 * Generate UI response via Ollama.
 *
 * This function works similarly to the streaming function above.
 * It sends the conversation history to Ollama, reads the stream, accumulates
 * the "response" fields into a plain text string, and then returns an updated
 * messages object with the assistant's reply.
 */
export async function continueConversation(history: Message[]) {
  const prompt = history.map(msg => msg.content).join("\n");
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tinyllama",
      prompt,
      stream: true
    }),
  });

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let aggregatedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(line => line.trim().length > 0);
    for (const line of lines) {
      try {
        const jsonObj = JSON.parse(line);
        aggregatedText += jsonObj.response;
      } catch (err) {
        console.error("Error parsing JSON line:", line, err);
      }
    }
  }

  // Serialize to ensure a plain string.
  const plainText = JSON.parse(JSON.stringify(aggregatedText));
  
  return JSON.parse(
    JSON.stringify({
      messages: [
        ...history,
        {
          role: "assistant",
          content: plainText,
          display: plainText // Pass plain text instead of a React element.
        },
      ],
    })
  );
}

/**
 * Check AI Availability.
 *
 * Since Ollama runs locally without requiring an API key, this always returns true.
 */
export async function checkAIAvailability() {
  return true;
}
