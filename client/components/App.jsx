import { useEffect, useRef, useState } from "react";
// import logo from "/assets/openai-logomark.svg";
import logo from "/assets/phonevoice-icon.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";

export default function App() {

  const [systemMessage, setSystemMessage] = useState(
    // "Dis bonjour à l'utilisateur avec: Bonjour, comment puis-je vous aider aujourd'hui ?"
    "You are a friendly and helpful assistant. Talk quickly."
  );

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [layout, setLayout] = useState('button');
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  async function startSession() {
    // Get an ephemeral key from the Fastify server
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    
    // Attendre que le canal soit ouvert pour envoyer le message initial
    dc.onopen = () => {
      console.log("Data channel is open, waiting before sending initial message");
      
      // Attendre un peu avant d'envoyer les messages
      setTimeout(() => {
        console.log("Sending initial messages");
        // Créer un message initial pour faire parler l'assistant
        const initialMessage = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Dis bonjour",
              },
            ],
          },
        };
        // Utiliser directement le canal de données
        dc.send(JSON.stringify(initialMessage));

        // Demander une réponse de l'assistant
        const responseRequest = {
          type: "response.create"
        };
        dc.send(JSON.stringify(responseRequest));
      }, 100);
    };

    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const voice = "ash";
    // Supported values are: 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', and 'verse'.

    const url = `${baseUrl}?model=${model}&voice=${voice}&instructions=${encodeURIComponent(systemMessage)}`;
    const sdpResponse = await fetch(url, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;

  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }


  function updateSystemMessage(newMessage) {
    if (dataChannel) {
      const updateEvent = {
        type: "system.update",
        content: [
          {
            type: "input_text",
            text: newMessage,
          },
        ],
      };
      sendClientEvent(updateEvent);
      setSystemMessage(newMessage);
    }
  }

  function updateSystemMessage(e) {
    e.preventDefault();
    if (dataChannel) {
      console.log("Sending updated system message:", systemMessage);
      const updateEvent = {
        type: "session.update",
        session: {
          instructions: systemMessage,
        },
      };
      sendClientEvent(updateEvent);
      setSystemMessage(systemMessage); // Met à jour l'état local
    } else {
      console.error("Data channel is not available to send the system message.");
    }
  }
  
  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  const fetchRoomData = async (room_id) => {
    console.log("Fetching room data for room ID:", room_id);
    console.log("URL:", `https://api.phonevoice.ai/rooms/${room_id}.json`);
    try {
      const response = await fetch(`https://api.phonevoice.ai/rooms/${room_id}.json`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setSystemMessage(data.system_message);
      setRoomName(data.name); // Ajout du nom de la Room à l'état
      setRoomId(room_id);
    } catch (error) {
      console.error('Error fetching room data:', error);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room_id = params.get('room_id');
    if (room_id) {
      fetchRoomData(room_id);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const layout = params.get('layout');
    if (layout) {
      setLayout(layout);
    }
    setIsLayoutLoaded(true);
  }, []);

  if (!isLayoutLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    );
  }

  if (layout === "button") {
    return (
      <SessionControls
        startSession={startSession}
        stopSession={stopSession}
        sendClientEvent={sendClientEvent}
        sendTextMessage={sendTextMessage}
        events={events}
        isSessionActive={isSessionActive}
        layout={layout}
      />
    );
  }

  if (layout === "blank") {
    return (
      <>
        <main className="absolute top-5 left-0 right-0 bottom-0">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </main>
      </>
    );
  }

  if (layout === "full") {
    

    return (
      <>
        <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
          <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
            <img style={{ width: "24px" }} src={logo} />
            <h1>
              PhoneVoice - Realtime console
              {roomName && ` - `}
              {roomName && (
                <a href={`https://phonevoice.ai/rooms/${roomId}`} className="text-blue-500 underline" target="_blank">
                  {roomName}
                </a>
              )}
            </h1>
          </div>
        </nav>
        <main className="absolute top-16 left-0 right-0 bottom-0">
          <section className="absolute top-0 left-0 right-[380px] bottom-0 flex">
            <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
              <EventLog events={events} />
            </section>
            <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
              <SessionControls
                startSession={startSession}
                stopSession={stopSession}
                sendClientEvent={sendClientEvent}
                sendTextMessage={sendTextMessage}
                events={events}
                isSessionActive={isSessionActive}
              />
            </section>
          </section>
          {layout !== 'blank' && (
            <section className="absolute top-0 w-[380px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
              <ToolPanel
                isSessionActive={isSessionActive}
                sendClientEvent={sendClientEvent}
                events={events}
                systemMessage={systemMessage}
                setSystemMessage={setSystemMessage}
                updateSystemMessage={updateSystemMessage}
                layout={layout}
              />
            </section>
          )}
        </main>
      </>
    );
  }
}
