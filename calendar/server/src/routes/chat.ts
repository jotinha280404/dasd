import type { ChatMessage, ChatRequest } from "@dasd/cal-shared";
import { Hono } from "hono";
import { handleChat } from "../assistant/chat";

/** `POST /api/chat` → the natural-language calendar assistant. */
export const chatRoutes = new Hono();

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseHistory(value: unknown): ChatMessage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ChatMessage[] = [];
  for (const item of value) {
    if (
      isRecord(item) &&
      (item["role"] === "user" || item["role"] === "assistant") &&
      typeof item["content"] === "string"
    ) {
      out.push({ role: item["role"], content: item["content"] });
    }
  }
  return out;
}

chatRoutes.post("/", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  if (!isRecord(body) || typeof body["message"] !== "string" || body["message"].trim() === "") {
    return c.json({ error: "a non-empty 'message' string is required" }, 400);
  }
  const req: ChatRequest = {
    message: body["message"],
    history: parseHistory(body["history"]),
    timezone: typeof body["timezone"] === "string" ? body["timezone"] : undefined,
    now: typeof body["now"] === "string" ? body["now"] : undefined,
  };
  const response = await handleChat(req);
  return c.json(response);
});
