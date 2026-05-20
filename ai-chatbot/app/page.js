"use client";

import {
  Bot,
  Brain,
  Loader2,
  RotateCcw,
  Search,
  Send,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function createMessage(role, content, status = "") {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    status,
  };
}

function renderInlineMarkdown(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const isStrong = token.startsWith("**");
    const value = isStrong ? token.slice(2, -2) : token.slice(1, -1);
    parts.push(
      <strong key={`${keyPrefix}-strong-${match.index}`}>{value}</strong>,
    );
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}

function MessageContent({ content }) {
  const lines = content.split("\n");
  const blocks = [];
  let listItems = [];
  let listType = null;

  function flushList() {
    if (!listItems.length) return;
    const ListTag = listType === "ordered" ? "ol" : "ul";
    const items = listItems;
    blocks.push(
      <ListTag className="messageList" key={`list-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={`item-${index}`}>
            {renderInlineMarkdown(item, `list-${blocks.length}-${index}`)}
          </li>
        ))}
      </ListTag>,
    );
    listItems = [];
    listType = null;
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (!trimmed) {
      flushList();
      blocks.push(<p key={`empty-${index}`}>&nbsp;</p>);
      return;
    }

    if (headingMatch) {
      flushList();
      const HeadingTag = `h${Math.min(headingMatch[1].length + 2, 4)}`;
      blocks.push(
        <HeadingTag className="messageHeading" key={`heading-${index}`}>
          {renderInlineMarkdown(headingMatch[2], `heading-${index}`)}
        </HeadingTag>,
      );
      return;
    }

    if (unorderedMatch || orderedMatch) {
      const nextType = orderedMatch ? "ordered" : "unordered";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unorderedMatch || orderedMatch)[1]);
      return;
    }

    flushList();
    blocks.push(
      <p key={`paragraph-${index}`}>
        {renderInlineMarkdown(line, `paragraph-${index}`)}
      </p>,
    );
  });

  flushList();

  return <div className="messageContent">{blocks}</div>;
}

function appendMessageContent(messages, messageId, delta) {
  return messages.map((message) => {
    if (message.id !== messageId) return message;
    return {
      ...message,
      content: `${message.content}${delta}`,
      status: "",
    };
  });
}

function replaceMessageContent(messages, messageId, content) {
  return messages.map((message) => {
    if (message.id !== messageId) return message;
    return {
      ...message,
      content: content || message.content,
      status: "",
    };
  });
}

function completeMessage(messages, messageId, content) {
  return messages.map((message) => {
    if (message.id !== messageId) return message;
    return {
      ...message,
      content: content || message.content || "Jawaban selesai, tetapi konten tidak tersedia.",
      status: "done",
    };
  });
}

function updateMessageStatus(messages, messageId, status) {
  return messages.map((message) => {
    if (message.id !== messageId) return message;
    return {
      ...message,
      status,
    };
  });
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const hasStartedChat = messages.some((message) => message.role === "user");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function resetChat() {
    setMessages([]);
    setInput("");
    setSessionId("");
    setError("");
    setSearchEnabled(true);
    setThinkingEnabled(false);
    inputRef.current?.focus();
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage = createMessage("user", trimmed);
    const assistantMessage = createMessage(
      "assistant",
      "",
      thinkingEnabled ? "thinking" : "answering",
    );
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    const controller = new AbortController();
    const requestTimeoutMs = thinkingEnabled ? 900000 : 300000;
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      requestTimeoutMs,
    );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionId || undefined,
          search: searchEnabled,
          thinking: thinkingEnabled,
          stream: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.resetSession) {
          setSessionId("");
        }
        throw new Error(data.error || "Gagal mengirim pesan.");
      }

      if (!response.body) {
        throw new Error("Browser tidak mendukung streaming response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line);

          if (event.type === "session") {
            setSessionId(event.sessionId || "");
          }

          if (event.type === "thinking") {
            setMessages((current) =>
              updateMessageStatus(current, assistantMessage.id, "thinking"),
            );
          }

          if (event.type === "delta") {
            if (typeof event.content === "string") {
              setMessages((current) =>
                replaceMessageContent(
                  current,
                  assistantMessage.id,
                  event.content,
                ),
              );
            } else {
              setMessages((current) =>
                appendMessageContent(
                  current,
                  assistantMessage.id,
                  event.delta || "",
                ),
              );
            }
          }

          if (event.type === "done") {
            setSessionId(event.sessionId || "");
            setMessages((current) =>
              completeMessage(
                current,
                assistantMessage.id,
                event.message?.content || "",
              ),
            );
          }

          if (event.type === "error") {
            if (event.resetSession) {
              setSessionId("");
            }
            throw new Error(event.error || "Gagal mengirim pesan.");
          }
        }
      }

      if (buffer.trim()) {
        const event = JSON.parse(buffer);
        if (event.type === "done") {
          setSessionId(event.sessionId || "");
          setMessages((current) =>
            completeMessage(
              current,
              assistantMessage.id,
              event.message?.content || "",
            ),
          );
        }
      }
    } catch (err) {
      const message =
        err.name === "AbortError"
          ? "Request terlalu lama. Coba ulangi sebentar lagi atau matikan Thinking untuk jawaban yang lebih cepat."
          : err.message || "Gagal mengirim pesan.";
      setError(message);
      setMessages((current) =>
        current.filter(
          (chatMessage) =>
            chatMessage.id !== assistantMessage.id || chatMessage.content,
        ),
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className={`shell ${hasStartedChat ? "activeShell" : "idleShell"}`}>
      {hasStartedChat && (
        <aside className="sidebar">
          <div className="brandPanel">
            <div className="brand">
              <span className="brandMark">
                <Bot size={22} aria-hidden="true" />
              </span>
              <div>
                <h1>XyloAI</h1>
                <p>DeepSeek Scraper by DhoDho</p>
              </div>
            </div>

            <div className="statusPanel" aria-label="Status">
              <span className="statusDot" aria-hidden="true" />
              <span>Online</span>
            </div>
          </div>

          <button className="resetButton" type="button" onClick={resetChat}>
            <RotateCcw size={18} aria-hidden="true" />
            Chat Baru
          </button>
        </aside>
      )}

      <section
        className={`chatPanel ${hasStartedChat ? "activePanel" : "idlePanel"}`}
        aria-label="Percakapan"
      >
        {!hasStartedChat && (
          <div className="idleHero">
            <span className="idleMark" aria-hidden="true">
              <Bot size={24} />
            </span>
            <h2>Apa yang bisa XyloAI bantu?</h2>
          </div>
        )}

        {hasStartedChat && (
          <div className="messages" role="log" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`message ${message.role === "user" ? "userMessage" : "assistantMessage"}`}
                key={message.id}
              >
                <span className="avatar" aria-hidden="true">
                  {message.role === "user" ? (
                    <User size={17} />
                  ) : (
                    <Bot size={17} />
                  )}
                </span>
                <div
                  className={`bubble ${
                    message.role === "assistant" &&
                    !message.content &&
                    message.status !== "done"
                      ? "typing"
                      : ""
                  }`}
                >
                  {message.role === "assistant" &&
                  !message.content &&
                  message.status !== "done" ? (
                    <>
                      <Loader2 size={17} aria-hidden="true" />
                      <span>
                        {message.status === "thinking"
                          ? "Thinking..."
                          : "Menjawab..."}
                      </span>
                    </>
                  ) : (
                    <MessageContent content={message.content} />
                  )}
                </div>
              </article>
            ))}

            <div ref={endRef} />
          </div>
        )}

        {error && (
          <div className="errorBanner" role="alert">
            {error}
          </div>
        )}

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <div className="composerControls" aria-label="Mode chat">
            <button
              className={`modeToggle ${searchEnabled ? "isActive" : ""}`}
              type="button"
              aria-pressed={searchEnabled}
              disabled={isSending}
              onClick={() => setSearchEnabled((value) => !value)}
            >
              <Search size={16} aria-hidden="true" />
              Search
            </button>
            <button
              className={`modeToggle ${thinkingEnabled ? "isActive" : ""}`}
              type="button"
              aria-pressed={thinkingEnabled}
              disabled={isSending}
              onClick={() => setThinkingEnabled((value) => !value)}
            >
              <Brain size={16} aria-hidden="true" />
              Thinking
            </button>
          </div>

          <div className="composerInputRow">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              rows={1}
              disabled={isSending}
            />
            <button
              className={`sendButton ${isSending ? "isSending" : ""}`}
              type="submit"
              disabled={!input.trim() || isSending}
              title="Kirim"
              aria-label="Kirim pesan"
            >
              {isSending ? (
                <Loader2 size={19} aria-hidden="true" />
              ) : (
                <Send size={19} aria-hidden="true" />
              )}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
