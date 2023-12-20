import { type UseChatHelpers } from "ai/react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

import { PromptForm } from "./chat-prompt-form";

import "../App.css";
import { usePostHog } from "posthog-js/react";

export interface ChatPanelProps
  extends Pick<
    UseChatHelpers,
    | "append"
    | "isLoading"
    | "reload"
    | "messages"
    | "stop"
    | "input"
    | "setInput"
  > {
  id?: string;
  isStreaming: boolean;
}

export function ChatPanel({
  id,
  isLoading,
  stop,
  append,
  reload,
  input,
  setInput,
  messages,
  isStreaming,
}: ChatPanelProps) {
  const posthog = usePostHog();

  return (
    <div>
      <div>
        <div>
          <PromptForm
            onSubmit={async (value) => {
              console.log("Chat message sent", value);
              posthog.capture("Chat message sent", {
                source: "onboard-vscode"
              });
              await append({
                id,
                content: value,
                role: "user",
              });
            }}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            isStreaming={isStreaming}
            renderButton={() => isLoading ? (
              <VSCodeButton
                appearance="secondary"
                aria-label="Stop generating"
                onClick={() => stop()}
                className="button"
              >
                Stop generating
              </VSCodeButton>
            ) : (
              messages?.length > 1 && (
                <VSCodeButton
                  appearance="secondary"
                  aria-label="Regenerate response"
                  onClick={() => reload()}
                  className="button"
                >
                  Regenerate response
                </VSCodeButton>
              )
            )}
          />
        </div>
      </div>
    </div>
  );
}
