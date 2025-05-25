'use server';

import { CoreMessage } from 'ai';
import { ReactNode } from 'react';
import { z } from 'zod';
import { Weather } from '@/components/weather';

/**
 * A plain-JSON message structure where all values are simple types.
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  // Using a plain string for display instead of a React element.
  display?: string;
}

// Default system prompt that can be customized.
const DEFAULT_SYSTEM_PROMPT =
  "You are assistant of someone called Shovian, you call him Master Shovian. Now,";

/**
 * Helper function to accumulate Ollama TinyLlama’s streamed response.
 *
 * The response is streamed as JSON lines, each with the format:
 *   {"model": "tinyllama", "created_at": "TIMESTAMP", "response": " ...", "done": false}
 *
 * This function decodes the binary stream, splits it into lines,
 * parses each JSON object, and concatenates each "response" field into one plain string.
 */
async function accumulateOllamaResponse(responseBody: ReadableStream<Uint8Array>): Promise<string> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let aggregatedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        aggregatedText += obj.response;
      } catch (error) {
        console.error("Error parsing JSON line:", line, error);
      }
    }
  }

  return aggregatedText;
}

/**
 * continueTextConversation
 *
 * Sends the conversation messages to Ollama and returns the accumulated response as a plain string.
 * A system prompt is prepended to the conversation to guide the AI.
 */
export async function continueTextConversation(
  messages: CoreMessage[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<string> {
  // Prepend the system prompt before the conversation.
  const conversationText = messages.map((msg) => msg.content).join("\n");
  const prompt = `${systemPrompt}\n\n${conversationText}`;

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
  return aggregatedText;
}

/**
 * continueConversation
 *
 * Sends the conversation history to Ollama and returns a plain object
 * containing the updated messages history with the assistant’s reply.
 * A system prompt is prepended to the conversation.
 */
export async function continueConversation(
  history: Message[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<{ messages: Message[] }> {
  // Prepend system prompt to the conversation history.
  const conversationText = history.map((msg) => msg.content).join("\n");
  const prompt = `${systemPrompt}\n\n${conversationText}`;

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
    display: aggregatedText, // plain text only
  };

  const updatedResult = { messages: [...history, newMessage] };
  return JSON.parse(JSON.stringify(updatedResult));
}

/**
 * checkAIAvailability
 *
 * Always returns true because Ollama runs locally and does not require an API key.
 */
export async function checkAIAvailability() {
  return true;
}
