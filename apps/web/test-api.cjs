import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  path: "/socket.io"
});

socket.on("connect", () => {
  console.log("Connected to local API");
  
  // First join a match
  socket.emit("lobby:join", {
    slug: "test", // Doesn't matter if it fails, we want to see if the server crashes
    sessionId: "test-session-123",
    username: "test-user"
  });
});

socket.on("match:error", (err) => {
  console.log("Match error:", err);
  // We expect "Join a lobby first" or "Challenge not found"
  if (err.message === "Challenge not found") {
      // The server is up and responding!
      console.log("Server responded properly.");
      process.exit(0);
  }
});

setTimeout(() => {
  console.log("Timeout");
  process.exit(1);
}, 2000);
