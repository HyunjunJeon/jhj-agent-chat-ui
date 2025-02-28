import { ThreadMessageLike, ToolCallContentPart } from "@assistant-ui/react";
import { Message, AIMessage, ToolMessage } from "@langchain/langgraph-sdk";

export const getMessageType = (message: Record<string, any>): string => {
  if (Array.isArray(message.id)) {
    const lastItem = message.id[message.id.length - 1];
    if (lastItem.startsWith("HumanMessage")) {
      return "human";
    } else if (lastItem.startsWith("AIMessage")) {
      return "ai";
    } else if (lastItem.startsWith("ToolMessage")) {
      return "tool";
    } else if (
      lastItem.startsWith("BaseMessage") ||
      lastItem.startsWith("SystemMessage")
    ) {
      return "system";
    }
  }

  if ("getType" in message && typeof message.getType === "function") {
    return message.getType();
  } else if ("_getType" in message && typeof message._getType === "function") {
    return message._getType();
  } else if ("type" in message) {
    return message.type as string;
  } else {
    console.error(message);
    throw new Error("Unsupported message type");
  }
};

function getMessageContentOrThrow(message: unknown): string {
  if (typeof message !== "object" || message === null) {
    return "";
  }

  const castMsg = message as Record<string, any>;

  if (
    typeof castMsg?.content !== "string" &&
    (!Array.isArray(castMsg.content) || castMsg.content[0]?.type !== "text") &&
    (!castMsg.kwargs ||
      !castMsg.kwargs?.content ||
      typeof castMsg.kwargs?.content !== "string")
  ) {
    console.error(castMsg);
    throw new Error("Only text messages are supported");
  }

  let content = "";
  if (Array.isArray(castMsg.content) && castMsg.content[0]?.type === "text") {
    content = castMsg.content[0].text;
  } else if (typeof castMsg.content === "string") {
    content = castMsg.content;
  } else if (
    castMsg?.kwargs &&
    castMsg.kwargs?.content &&
    typeof castMsg.kwargs?.content === "string"
  ) {
    content = castMsg.kwargs.content;
  }

  return content;
}

export function convertLangChainMessages(message: Message): ThreadMessageLike {
  const content = getMessageContentOrThrow(message);

  switch (getMessageType(message)) {
    case "system":
      return {
        role: "system",
        id: message.id,
        content: [{ type: "text", text: content }],
      };
    case "human":
      return {
        role: "user",
        id: message.id,
        content: [{ type: "text", text: content }],
      };
    case "ai":
      const aiMsg = message as AIMessage;
      const toolCallsContent: ToolCallContentPart[] = aiMsg.tool_calls?.length
        ? aiMsg.tool_calls.map((tc) => ({
            type: "tool-call" as const,
            toolCallId: tc.id ?? "",
            toolName: tc.name,
            args: tc.args,
            argsText: JSON.stringify(tc.args),
          }))
        : [];
      return {
        role: "assistant",
        id: message.id,
        content: [
          ...toolCallsContent,
          {
            type: "text",
            text: content,
          },
        ],
      };
    case "tool":
      const toolMsg = message as ToolMessage;
      return {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolName: toolMsg.name ?? "ToolCall",
            toolCallId: toolMsg.tool_call_id,
            result: content,
          },
        ],
      };
    default:
      console.error(message);
      throw new Error(`Unsupported message type: ${getMessageType(message)}`);
  }
}
