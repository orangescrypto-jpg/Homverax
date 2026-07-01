import { NextRequest, NextResponse } from "next/server";

/**
 * /api/ai/chat
 * HomveraX AI assistant powered by Claude.
 *
 * TO ENABLE: Add ANTHROPIC_API_KEY to your .env.local
 * The key is never exposed to the browser (no NEXT_PUBLIC_ prefix).
 */

const SYSTEM_PROMPT = `You are HomveraX AI, an intelligent assistant for HomveraX — Nigeria's most trusted property and services marketplace.

You help users with:
- Finding properties: apartments, houses, land, shortlets across Nigeria
- Understanding escrow: how payments are protected, how the process works
- Agent verification: BVN, NIN, and document verification steps
- Listing guidance: how to create, boost, and manage listings
- Service providers: cleaning, repairs, installation, logistics
- Platform features: subscriptions, messaging, bookings

Guidelines:
- Be helpful, concise, and friendly
- Use Nigerian context (₦ for currency, Nigerian states, lgas)
- If asked about a specific listing, use the context provided
- Don't make up listing details — guide users to browse on the platform
- Keep responses under 150 words unless a detailed explanation is needed
- Format with **bold** for key terms when helpful`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { reply: "AI assistant is not configured yet. Add ANTHROPIC_API_KEY to your environment variables to enable it." },
      { status: 200 }
    );
  }

  try {
    const { message, context, history = [] } = await req.json();

    const messages = [
      // Include recent history
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      // Current message with optional listing context
      {
        role: "user" as const,
        content: context ? `[Context: ${context}]\n\n${message}` : message,
      },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? "I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json(
      { reply: "Sorry, I'm having trouble right now. Please try again in a moment." },
      { status: 200 }
    );
  }
}
