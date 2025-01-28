import { useEffect, useRef, useState } from "react";
import logo from "/assets/phonevoice-icon.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import Waveform from "./Waveform";

export default function App() {

  const [systemMessage, setSystemMessage] = useState(
    "You are a friendly and helpful assistant. Talk quickly."
  );

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [layout, setLayout] = useState('button');
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
  const [isRoomLoaded, setIsRoomLoaded] = useState(false);
  const [hasRoomError, setHasRoomError] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('ash');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [assistantAudioStream, setAssistantAudioStream] = useState(null);
  const [userAudioStream, setUserAudioStream] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const audioContext = useRef(null);
  const userAnalyser = useRef(null);
  const assistantAnalyser = useRef(null);
  const audioDataArray = useRef(null);
  const checkAudioInterval = useRef(null);

  // Fonction pour détecter le son de l'utilisateur
  const setupVoiceDetection = async (stream) => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!userAnalyser.current) {
      userAnalyser.current = audioContext.current.createAnalyser();
      userAnalyser.current.fftSize = 256;
      audioDataArray.current = new Uint8Array(userAnalyser.current.frequencyBinCount);
    }

    const source = audioContext.current.createMediaStreamSource(stream);
    source.connect(userAnalyser.current);

    // Nettoyer l'intervalle existant si présent
    if (checkAudioInterval.current) {
      clearInterval(checkAudioInterval.current);
    }

    // Vérifier le niveau sonore toutes les 100ms
    const THRESHOLD = 30;
    let voiceDetected = false;

    checkAudioInterval.current = setInterval(() => {
      // Vérifier si l'analyseur existe toujours
      if (!userAnalyser.current) {
        clearInterval(checkAudioInterval.current);
        return;
      }

      try {
        userAnalyser.current.getByteFrequencyData(audioDataArray.current);
        const average = audioDataArray.current.reduce((a, b) => a + b) / audioDataArray.current.length;

        if (average > THRESHOLD && !voiceDetected) {
          voiceDetected = true;
          setIsUserSpeaking(true);
        } else if (average <= THRESHOLD && voiceDetected) {
          voiceDetected = false;
          setIsUserSpeaking(false);
        }
      } catch (error) {
        console.error('Error in voice detection:', error);
        clearInterval(checkAudioInterval.current);
      }
    }, 100);
  };

  // Configurer l'audio de l'assistant
  const setupAssistantAudio = (stream) => {
    console.log('Setting up assistant audio...', { stream });
    
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Created new audio context');
      }

      // Créer l'analyseur pour l'assistant
      if (!assistantAnalyser.current) {
        assistantAnalyser.current = audioContext.current.createAnalyser();
        assistantAnalyser.current.fftSize = 256;
        assistantAnalyser.current.smoothingTimeConstant = 0.8;
        console.log('Created assistant analyser');
      }

      // Créer l'élément audio pour la lecture
      if (!audioElement.current) {
        audioElement.current = new Audio();
        audioElement.current.srcObject = stream;
        audioElement.current.autoplay = true;
        console.log('Created and configured audio element');
      }

      // Créer la source à partir du stream
      const source = audioContext.current.createMediaStreamSource(stream);
      console.log('Created media stream source');

      // Connecter uniquement à l'analyseur (pas à la destination)
      source.connect(assistantAnalyser.current);
      console.log('Connected source to analyser');

    } catch (error) {
      console.error('Error in setupAssistantAudio:', error);
    }
  };

  // Nettoyer les ressources audio
  useEffect(() => {
    return () => {
      // Nettoyer l'intervalle
      if (checkAudioInterval.current) {
        clearInterval(checkAudioInterval.current);
        checkAudioInterval.current = null;
      }

      // Nettoyer l'audio
      if (audioContext.current) {
        audioContext.current.close();
        audioContext.current = null;
      }
      if (audioElement.current) {
        audioElement.current.pause();
        audioElement.current.srcObject = null;
        audioElement.current = null;
      }

      // Réinitialiser les analyseurs
      userAnalyser.current = null;
      assistantAnalyser.current = null;
      audioDataArray.current = null;
    };
  }, []);

  async function startSession() {
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    const pc = new RTCPeerConnection();
    peerConnection.current = pc;

    // Configurer l'audio de l'assistant
    pc.ontrack = (e) => {
      console.log('Assistant audio stream received:', e.streams[0]);
      console.log('Stream active:', e.streams[0].active);
      console.log('Audio tracks:', e.streams[0].getAudioTracks());
      
      const stream = e.streams[0];
      setAssistantAudioStream(stream);
      
      // Attendre un peu que le stream soit prêt
      setTimeout(() => {
        console.log('Setting up assistant audio after delay');
        setupAssistantAudio(stream);
      }, 100);
    };

    // Configurer l'audio de l'utilisateur
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('Microphone stream obtained');
      pc.addTrack(stream.getTracks()[0]);
      setUserAudioStream(stream);
      
      // Configurer la détection de voix
      await setupVoiceDetection(stream);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }

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
                text: firstMessage ? `Dis bonjour au user en disant: ${firstMessage}` : "Dis bonjour",
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
    const voice = selectedVoice;
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

  }

  // Stop current session, clean up peer connection and data channel
  const stopSession = async () => {
    // Nettoyer l'intervalle
    if (checkAudioInterval.current) {
      clearInterval(checkAudioInterval.current);
      checkAudioInterval.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (dataChannel) {
      dataChannel.close();
    }

    // Nettoyer l'audio
    if (audioElement.current) {
      audioElement.current.pause();
      audioElement.current.srcObject = null;
      audioElement.current = null;
    }

    if (audioContext.current) {
      await audioContext.current.close();
      audioContext.current = null;
    }

    // Réinitialiser les analyseurs
    userAnalyser.current = null;
    assistantAnalyser.current = null;
    audioDataArray.current = null;

    setIsSessionActive(false);
    setEvents([]);
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setAssistantAudioStream(null);
    setUserAudioStream(null);
  };

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
  
  // Gérer les événements du canal de données
  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (e) => {
      const event = JSON.parse(e.data);
      
      // Mettre à jour la liste des événements
      setEvents(prev => [...prev, event]);

      // Gérer les événements de parole de l'assistant
      if (event.type === "output_audio_buffer.audio_started") {
        setIsSpeaking(true);
      } else if (event.type === "output_audio_buffer.audio_stopped") {
        setIsSpeaking(false);
      }
    };

    dataChannel.addEventListener("message", handleMessage);
    
    return () => {
      dataChannel.removeEventListener("message", handleMessage);
    };
  }, [dataChannel]);

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (!dataChannel) return;

    const handleEvent = (event) => {
      console.log("Raw event received:", event);

      // Gérer les événements de parole de l'assistant
      if (event.type === "output_audio_buffer.audio_started") {
        console.log("Assistant started speaking");
        setIsSpeaking(true);
      } else if (event.type === "output_audio_buffer.audio_stopped") {
        console.log("Assistant stopped speaking");
        setIsSpeaking(false);
      }

      // Gérer les événements de parole de l'utilisateur
      if (event.type === "input_audio_buffer.speech_started") {
        console.log("User started speaking");
        setIsUserSpeaking(true);
      } else if (event.type === "input_audio_buffer.speech_stopped") {
        console.log("User stopped speaking");
        setIsUserSpeaking(false);
      }

      // Gérer les autres événements
      if (
        event.type === "session.created" ||
        event.type === "session.updated" ||
        event.type === "response.created" ||
        event.type === "response.output_item.added" ||
        event.type === "conversation.item.created" ||
        event.type === "response.content_part.added" ||
        event.type === "response.audio_transcript.delta" ||
        event.type === "response.audio_transcript.done" ||
        event.type === "response.content_part.done" ||
        event.type === "response.output_item.done" ||
        event.type === "response.done" ||
        event.type === "rate_limits.updated"
      ) {
        setEvents((prevEvents) => {
          // Vérifier si l'événement existe déjà
          const exists = prevEvents.some(e => e.event_id === event.event_id);
          if (exists) {
            return prevEvents;
          }
          return [...prevEvents, event];
        });
      }
    };

    const messageHandler = (e) => {
      try {
        const event = JSON.parse(e.data);
        handleEvent(event);
      } catch (error) {
        console.error("Error handling message:", error);
      }
    };

    // Ajouter le gestionnaire d'événements
    dataChannel.addEventListener("message", messageHandler);

    // Nettoyer le gestionnaire d'événements
    return () => {
      dataChannel.removeEventListener("message", messageHandler);
    };
  }, [dataChannel]);

  // Effet pour logger les changements d'état de la parole
  useEffect(() => {
    console.log("Assistant speaking state:", isSpeaking);
  }, [isSpeaking]);

  useEffect(() => {
    console.log("User speaking state:", isUserSpeaking);
  }, [isUserSpeaking]);

  // Effet pour initialiser la session quand le canal de données est ouvert
  useEffect(() => {
    if (dataChannel?.readyState === "open") {
      console.log("Data channel opened, initializing session");
      setIsSessionActive(true);
      setEvents([]);
    }
  }, [dataChannel?.readyState]);

  useEffect(() => {
    console.log('Assistant speaking state changed:', isSpeaking);
  }, [isSpeaking]);

  useEffect(() => {
    console.log('User speaking state changed:', isUserSpeaking);
  }, [isUserSpeaking]);

  useEffect(() => {
    console.log('Assistant audio stream changed:', assistantAudioStream);
  }, [assistantAudioStream]);

  useEffect(() => {
    console.log('User audio stream changed:', userAudioStream);
  }, [userAudioStream]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const layoutParam = params.get('layout');
    if (layoutParam) {
      setLayout(layoutParam);
    }
    setIsLayoutLoaded(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room_id = params.get('room_id');
    setRoomId(room_id);
    if (room_id) {
      fetchRoomData(room_id);
    } else {
      setIsRoomLoaded(true);
    }
  }, []);

  const fetchRoomData = async (room_id) => {
    console.log("Fetching room data for room ID:", room_id);
    console.log("URL:", `https://api.phonevoice.ai/rooms/${room_id}.json`);
    try {
      const response = await fetch(`https://api.phonevoice.ai/rooms/${room_id}.json`);
      if (!response.ok) {
        throw new Error('Unable to fetch room data.');
      }
      const data = await response.json();
      setSystemMessage(data.system_message);
      setRoomName(data.name); // Ajout du nom de la Room à l'état
      setRoomId(room_id);
      setFirstMessage(data.first_message || '');
      setHasRoomError(false);
    } catch (error) {
      console.error('Error fetching room data:', error);
      setHasRoomError(true);
    }
    setIsRoomLoaded(true);
  };

  const LoadingScreen = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      Loading...
    </div>
  );

  if (!isLayoutLoaded || !isRoomLoaded) {
    return <LoadingScreen />;
  }

  if (hasRoomError && roomId) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Unable to load room data.
      </div>
    );
  }

  if (layout === "button" || layout === "smart") {
    return (
      <div className="flex gap-4 items-center">
        {(layout === "smart" && isSessionActive) && (
          <section className="flex-1">
            <div className="h-[50px]">
              <Waveform 
                color1="rgba(255, 134, 71, 1)"
                color2="rgba(255, 64, 19, 1)"
                label1="Assistant"
                label2="User"
                analyserNode1={assistantAnalyser.current}
                analyserNode2={userAnalyser.current}
              />
            </div>
          </section>
        )}
        {!isSessionActive && <div className="flex-1" />}
        <section>
          <SessionControls
            startSession={startSession}
            stopSession={stopSession}
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
            layout={layout}
          />
        </section>
      </div>
    );
  }

  if (layout === "blank") {
    return (
      <>
        <main className="absolute top-5 left-0 right-0 bottom-0">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute bottom-32 left-0 right-0 h-24 px-4 flex flex-col gap-2">
            <div className="h-1/2">
              <Waveform 
                color="rgba(255, 134, 71, 1)"
                darkColor="rgba(255, 134, 71, 0.6)"
                label="Assistant"
                analyserNode={assistantAnalyser.current}
              />
            </div>
            <div className="h-1/2">
              <Waveform
                color="rgba(255, 64, 19, 1)"
                darkColor="rgba(255, 64, 19, 0.6)"
                label="User"
                analyserNode={userAnalyser.current}
              />
            </div>
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
              userAnalyser={userAnalyser.current}
              assistantAnalyser={assistantAnalyser.current}
            />
          </section>
        </main>
      </>
    );
  }

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
        <section className="absolute top-0 left-0 right-[380px] bottom-0 flex flex-col">
          <section className="flex-1 overflow-y-auto px-4">
            <EventLog events={events} />
          </section>
          {layout === "waveform" && (
            <section className="h-24 px-4">
              <div className="h-[50px]">
                <Waveform 
                  color1="rgba(255, 134, 71, 1)"
                  color2="rgba(255, 64, 19, 1)"
                  label1="Assistant"
                  label2="User"
                  analyserNode1={assistantAnalyser.current}
                  analyserNode2={userAnalyser.current}
                />
              </div>
            </section>
          )}
          <section className="h-32 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
              userAnalyser={userAnalyser.current}
              assistantAnalyser={assistantAnalyser.current}
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
              onVoiceChange={setSelectedVoice}
              layout={layout}
            />
          </section>
        )}
      </main>
    </>
  );
}
