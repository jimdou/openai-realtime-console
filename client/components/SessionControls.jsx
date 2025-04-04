import { useState } from "react";
import { CloudLightning, CloudOff, MessageSquare } from "react-feather";
import Button from "./Button";

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-end w-full h-full">
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleStartSession}
          className={isActivating ? "bg-gray-600" : "bg-red-600"}
          icon={<CloudLightning height={16} />}
        >
          {isActivating ? "Starting session..." : "Speak with assistant"}
        </Button>
      </div>
    </div>
  );
}

function SessionActive({ stopSession, sendTextMessage, layout }) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      {layout !== "button" && layout !== "smart" && (
        <>
          <input
            onKeyDown={(e) => {
              if (e.key === "Enter" && message.trim()) {
                handleSendClientEvent();
              }
            }}
            type="text"
            placeholder="Send a text message..."
            className="border border-gray-200 rounded-full p-4 flex-1"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button
            onClick={() => {
              if (message.trim()) {
                handleSendClientEvent();
              }
            }}
            icon={<MessageSquare height={16} />}
            className="bg-blue-400"
          >
            Send text
          </Button>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Button onClick={stopSession} icon={<CloudOff height={16} />}>
          Disconnect
        </Button>
      </div>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  serverEvents,
  isSessionActive,
  layout,
}) {
  return (
    <div className={layout !== "button" ? "flex gap-4 border-gray-200 h-full rounded-md bg-dark-2" : ""}>
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          serverEvents={serverEvents}
          layout={layout}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}
