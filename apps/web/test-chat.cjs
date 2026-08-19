const { io } = require("socket.io-client");

const socket = io("http://localhost:3001", {
  path: "/socket.io"
});

socket.on("connect", () => {
  console.log("Connected");
  
  // First join a match
  socket.emit("lobby:join", {
    slug: "test-slug",
    sessionId: "test-session-123",
    username: "test-user"
  });
});

socket.on("lobby:state", (state) => {
  console.log("Joined lobby", state.slug);
  
  // Send a chat message
  socket.emit("chat:send", { message: "Hello world!" });
});

socket.on("chat:receive", (msg) => {
  console.log("Received chat message:", msg);
  process.exit(0);
});

socket.on("match:error", (err) => {
  console.log("Error:", err);
});

setTimeout(() => {
  console.log("Timeout");
  process.exit(1);
}, 5000);
