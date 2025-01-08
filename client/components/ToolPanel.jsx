import { useEffect, useState } from "react";

const functionDescription = `
Call this function to book an appointment at Alain Coiffure. Open hours are Tuesday to Saturday from 9am to 6pm. Ask for an available time slot. Ask for a specific date and time. Ask for the name of the person booking the appointment. Ask for the name of the service. Ask for the phone number of the person booking the appointment.
`;

const sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "book_appointment",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            name: {
              type: "string",
              description: "Name of the person booking the appointment.",
            },
            service: {
              type: "string",
              description: "Name of the service being booked.",
            },
            date: {
              type: "string",
              description: "Date of the appointment in YYYY-MM-DD format.",
            },
            time: {
              type: "string",
              description: "Time of the appointment in HH:MM format.",
            },
            phone: {
              type: "string",
              description: "Phone number of the person booking the appointment.",
            },
            notes: {
              type: "string",
              description: "Additional notes for the appointment.",
            },
          },
          required: ["name", "date", "time", "service", "phone"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

function FunctionCallOutput({ functionCallOutput }) {
  const { name, date, time, service, phone, notes } = JSON.parse(functionCallOutput.arguments);

  return (
    <div className="flex flex-col gap-2">
      <p>Appointment Date: {date}</p>
      <p>Appointment Time: {time}</p>
      <p>Service: {service}</p>
      <p>Name: {name}</p>
      <p>Phone: {phone}</p>
      <p>Notes: {notes}</p>
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
  systemMessage,
  setSystemMessage,
  handleSystemMessageSubmit,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);

  useEffect(() => {
    if (!events || events.length === 0) return;

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        if (
          output.type === "function_call" &&
          output.name === "book_appointment"
        ) {
          setFunctionCallOutput(output);
          setTimeout(() => {
            sendClientEvent({
              type: "response.create",
              response: {
                instructions: `
                ask for feedback about the appointment - don't repeat 
                the details, just ask if they are happy with the booking.
              `,
              },
            });
          }, 500);
        }
      });
    }
  }, [events]);

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full rounded-md p-4">
        <h2 className="text-lg font-bold">Instructions</h2>
        <form onSubmit={handleSystemMessageSubmit} className="w-full">
          <div>
          <textarea
            value={systemMessage}
            onChange={(e) => setSystemMessage(e.target.value)}
            rows={10}
            placeholder="Entrez votre message ici..."
            className="border rounded-md p-2 w-full mb-3 bg-white text-black"
          />
          </div>
          <div>
          <button
            type="submit"
            onClick={handleSystemMessageSubmit}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full mb-3"
          >Update</button>
          </div>
        </form>

        <h2 className="text-lg font-bold">Function calling</h2>
        <p>
          Ask to book an appointment with Alain Coiffure. Open hours are Tuesday
          to Saturday from 9am to 6pm. Ask for an available time slot. Ask for a
          specific date and time. Ask for the name of the person booking the
          appointment. Ask for the name of the service. Ask for the phone number
          of the person booking the appointment.
        </p>
        <h2 className="text-lg font-bold">Hairdresser Appointment Tool</h2>
        {isSessionActive ? (
          functionCallOutput ? (
            <FunctionCallOutput functionCallOutput={functionCallOutput} />
          ) : (
            <p>Ask to book an appointment with Alain Coiffure...</p>
          )
        ) : (
          <p>Start the session to use this tool...</p>
        )}
      </div>
    </section>
  );
}
