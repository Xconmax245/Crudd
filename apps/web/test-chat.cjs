const { io } = require("socket.io-client");

async function run() {
  // Create a match first to get a valid slug
  const res = await fetch("http://localhost:3001/api/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bankId: "cm01z2aah000108jy5a593j2h", // I will fetch a real bank id first
      settings: {
        timePerQuestion: 10,
        randomizeQuestions: false
      }
    })
  });
  
  const text = await res.text();
  console.log("Create match response:", text);
}

run();
