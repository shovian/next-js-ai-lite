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
 * Reads the response stream from Ollama TinyLlama and accumulates only
 * the plain text in the "response" fields of each received JSON chunk.
 *
 * Each streamed chunk from Ollama is a JSON line such as:
 *   {"model":"tinyllama","created_at":"TIMESTAMP","response":" ...", "done":false}
 *
 * This function decodes the bytes, splits the text by newlines, parses each line,
 * and appends the extracted text to build a final plain string.
 */
async function accumulateOllamaResponse(responseBody: ReadableStream<Uint8Array>): Promise<string> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let aggregatedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Decode the binary chunk.
    const chunk = decoder.decode(value, { stream: true });
    // Split potentially multiple JSON lines.
    const lines = chunk.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        aggregatedText += obj.response;
      } catch (err) {
        console.error("Error parsing JSON line:", line, err);
      }
    }
  }
  return aggregatedText;
}

/**
 * Streaming Chat using Ollama (TinyLlama).
 *
 * Sends the conversation messages to Ollama, accumulates the streamed text response,
 * and returns a plain string.
 */
export async function continueTextConversation(messages: CoreMessage[]): Promise<string> {
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
    throw new Error("No response body returned from Ollama");
  }

  // Accumulate and return a plain string.
  const aggregatedText = await accumulateOllamaResponse(response.body);
  return aggregatedText;
}

/**
 * Generate UI responses via Ollama.
 *
 * Similar to continueTextConversation, but returns a plain object containing the updated
 * message history with the assistant’s reply. Both the "content" and "display" fields
 * will contain the plain text accumulated from the stream.
 */
export async function continueConversation(history: Message[]): Promise<{ messages: Message[] }> {
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
    throw new Error("No response body returned from Ollama");
  }

  const aggregatedText = await accumulateOllamaResponse(response.body);
  const newMessage: Message = {
    role: "assistant",
    content: aggregatedText,
    display: aggregatedText, // Using plain text for display
  };

  const updated = { messages: [...history, newMessage] };
  // Deep-serialize to ensure a plain object is returned.
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
