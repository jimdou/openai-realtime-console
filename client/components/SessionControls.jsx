import { useState } from "react";
import { CloudLightning, CloudOff, MessageSquare } from "react-feather";
import Button from "./Button";

const translations = {
  en: {
    start: "Speak with assistant",
    starting: "Starting session...",
    disconnect: "Disconnect",
    sendTextPlaceholder: "Send a text message...",
    sendTextButton: "Send text"
  },
  fr: {
    start: "Parler avec l'assistant",
    starting: "Démarrage...",
    disconnect: "Déconnexion",
    sendTextPlaceholder: "Envoyer un message...",
    sendTextButton: "Envoyer"
  }
};

function SessionStopped({ startSession, locale = 'en', enablePulse = false }) {
  const [isActivating, setIsActivating] = useState(false);
  const t = translations[locale] || translations.en;
  
  const breatheClass = enablePulse ? "animate-breathe" : "";

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleStartSession}
          className={isActivating ? "bg-gray-600" : `bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white font-bold font-sans shadow-[0_0_20px_rgba(236,72,153,0.5)] ${breatheClass} hover:animate-none hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-105 transition-all duration-300 border border-white/20`}
          icon={<CloudLightning height={16} />}
        >
          {isActivating ? t.starting : t.start}
        </Button>
      </div>
    </div>
  );
}

function SessionActive({ stopSession, sendTextMessage, layout, locale = 'en' }) {
  const [message, setMessage] = useState("");
  const t = translations[locale] || translations.en;

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
            placeholder={t.sendTextPlaceholder}
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
            {t.sendTextButton}
          </Button>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Button 
          onClick={stopSession} 
          icon={<CloudOff height={16} />}
          className="bg-gray-700 hover:bg-red-500/80 text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-white/10"
        >
          {t.disconnect}
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
  locale,
  enablePulse
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
          locale={locale}
        />
      ) : (
        <SessionStopped startSession={startSession} locale={locale} enablePulse={enablePulse} />
      )}
    </div>
  );
}
