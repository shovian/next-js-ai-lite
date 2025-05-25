'use server';

import { CoreMessage } from 'ai';
import { z } from 'zod';

/**
 * A plain-JSON message structure where all values are simple types.
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  // Instead of storing a React element in `display`, we store a plain string.
  display?: string;
}

// Default system prompt that can be customized.
const DEFAULT_SYSTEM_PROMPT =
  "You are someone called Shovian's assistant, and you call shovian Master.";

/**
 * Helper function to accumulate the response from Ollama TinyLlama.
 *
 * The response is streamed as JSON lines, each with the format:
 *   { "model": "tinyllama", "created_at": "TIMESTAMP", "response": " ...", "done": false }
 *
 * This function decodes the binary stream, splits it into lines,
 * parses each JSON object, and concatenates the "response" field into one plain string.
 */
async function accumulateOllamaResponse(responseBody: ReadableStream<Uint8Array>): Promise<string> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let aggregatedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Decode the chunk.
    const chunk = decoder.decode(value, { stream: true });
    // Split the chunk into lines (each expected to be a JSON object).
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
 * Sends the conversation messages to the local Ollama endpoint,
 * prepends a system prompt, accumulates the streamed response text,
 * and returns a plain string.
 *
 * You can pass an optional custom systemPrompt or use the default.
 */
export async function continueTextConversation(
  messages: CoreMessage[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<string> {
  // Prepend the system prompt before the conversation.
  const conversationText = messages.map((msg) => msg.content).join("\n");
  const prompt = `${systemPrompt}\n${conversationText}`;

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

  // Accumulate the plain text response.
  const aggregatedText = await accumulateOllamaResponse(response.body);
  return aggregatedText;
}

/**
 * continueConversation
 *
 * Sends the conversation history to the local Ollama endpoint,
 * prepends a system prompt, accumulates the streamed response text,
 * and returns a plain object that includes the updated messages history.
 *
 * Both the "content" and "display" fields contain only plain text.
 */
export async function continueConversation(
  history: Message[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<{ messages: Message[] }> {
  // Prepend system prompt to the conversation history.
  const conversationText = history.map((msg) => msg.content).join("\n");
  const prompt = `${systemPrompt}\n${conversationText}`;
  
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
  // Deep-serialize to ensure that only plain objects are returned.
  return JSON.parse(JSON.stringify(updatedResult));
}

/**
 * checkAIAvailability
 *
 * Always returns true since Ollama runs locally and does not require an API key.
 */
export async function checkAIAvailability() {
  return true;
}
