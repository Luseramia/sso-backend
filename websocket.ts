import { Elysia } from "elysia";
import { onSaveMessage } from "./chat";

export const websocketController = new Elysia().ws("/ws/chat", {
  idleTimeout: 255,
  open(ws) {
    console.log("client connected");
    ws.subscribe("chat");
    ws.send(
      JSON.stringify({ type: "message", text: "welcome", sender: "bot" }),
    );
  },

  async message(ws, message: any) {
    console.log("received message:", message);
    const payload = typeof message === "string" ? JSON.parse(message) : message;

    if (payload.type === "ping") return;

    // 1. Broadcast the user's message to everyone (including the sender's other tabs)
    ws.publish("chat", JSON.stringify(payload));
    if (message.text && message.sender === "owner") {
      const ownerResponse = {
        id: Date.now(),
        type: "message",
        text: message.text,
        sender: "owner",
        timestamp: new Date().toISOString(),
      };
      // Broadcast bot's reply to everyone
      ws.publish("chat", JSON.stringify(ownerResponse));
      ws.send(JSON.stringify(ownerResponse));
    }
    // 2. Trigger bot logic
    if (payload.text && payload.sender === "user") {
      try {
        const result = await onSaveMessage(payload.text);

        const botResponse = {
          id: Date.now(),
          type: "message",
          text:
            result.message === "Workflow was started"
              ? "ได้รับข้อความเรียบร้อย! (via WS)"
              : `เกิดข้อผิดพลาด: ${result.error || "N8N Error"}`,
          sender: "bot",
          timestamp: new Date().toISOString(),
        };

        // Broadcast bot's reply to everyone
        ws.publish("chat", JSON.stringify(botResponse));
        ws.send(JSON.stringify(botResponse));
      } catch (err) {
        console.error("WS Bot logic error:", err);
      }
    }
  },

  close(ws) {
    console.log("client disconnected");
    ws.unsubscribe("chat");
  },
});
