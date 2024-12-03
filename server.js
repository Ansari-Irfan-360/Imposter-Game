const wordGenreArray = require("./data.js");

const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
let rooms = {}; // Object to hold all game rooms and their players

// Function to update player count in a room
const updatePlayerCount = (roomId) => {
  const room = rooms[roomId];
  const playerNames = room.players.map((player) => player.name);
  const message = JSON.stringify({
    type: "playerCount",
    count: room.players.length,
    players: playerNames,
  });
  room.players.forEach((player) => player.ws.send(message));
};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      const { roomId, playerName } = data;

      // Check if the room already exists or create a new one
      if (!rooms[roomId]) {
        rooms[roomId] = { players: [], admin: null };
        console.log(`New room created: ${roomId}`);
      }
      const room = rooms[roomId];
      const player = { ws, name: playerName, isAdmin: false };
      room.players.push(player);

      // Assign admin status to the first player in the room
      if (room.players.length === 1) {
        player.isAdmin = true;
        room.admin = player;
        ws.send(JSON.stringify({ type: "joined", isAdmin: true }));
      } else {
        ws.send(JSON.stringify({ type: "joined", isAdmin: false }));
      }

      // Notify all players in the room about the updated player count
      updatePlayerCount(roomId);

       // Log the joining player and their room
      console.log(`${playerName} has joined room ${roomId}`);
    }

    if (data.type === "start" && ws === rooms[data.roomId].admin?.ws) {
      let imposterCount = parseInt(data.imposterCount, 10);
      const room = rooms[data.roomId];
      const playersCount = room.players.length;

      // If the admin wants a random number of imposters, pick a random count
      if (data.randomImposter) {
        imposterCount = Math.floor(Math.random() * imposterCount) + 1; // Random number between 1 and the specified max
      }

      // Validate imposter count
      if (imposterCount >= playersCount) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Imposter count is too high.",
          })
        );
        return;
      }
      const randomIndex = Math.floor(Math.random() * wordGenreArray.length);
      const chosenWord = wordGenreArray[randomIndex][0];
      const chosenGenre = wordGenreArray[randomIndex][1];
      const imposters = new Set();
      while (imposters.size < imposterCount) {
        const imposterIndex = Math.floor(Math.random() * room.players.length);
        imposters.add(room.players[imposterIndex]);
      }

      // Get names of imposters
      const imposterNames = Array.from(imposters).map((player) => player.name);

      // Send word to all players and reveal other imposters to the imposters
      room.players.forEach((player) => {
        if (imposters.has(player)) {
          player.ws.send(
            JSON.stringify({
              type: "gameStart",
              word: null, // Imposters don't get the word
              genre: data.genreCheck ? chosenGenre : null,
              imposters: imposterNames, // Reveal other imposters
            })
          );
        } else {
          player.ws.send(
            JSON.stringify({
              type: "gameStart",
              word: chosenWord, // Non-imposters get the word
              genre: data.genreCheck ? chosenGenre : null,
            })
          );
        }
      });
    }

    if (data.type === "nextGame" && ws === rooms[data.roomId].admin?.ws) {
      const room = rooms[data.roomId];
      let imposterCount = parseInt(data.imposterCount, 10);
      const randomIndex = Math.floor(Math.random() * wordGenreArray.length);
      const chosenWord = wordGenreArray[randomIndex][0];
      const chosenGenre = wordGenreArray[randomIndex][1];

      // If the admin wants a random number of imposters, pick a random count
      if (data.randomImposter) {
        imposterCount = Math.floor(Math.random() * imposterCount) + 1; // Random number between 1 and the specified max
      }

      const imposters = new Set();
      while (imposters.size < imposterCount) {
        const imposterIndex = Math.floor(Math.random() * room.players.length);
        imposters.add(room.players[imposterIndex]);
      }

      const imposterNames = Array.from(imposters).map((player) => player.name);

      // Send the new word and imposter information to all players
      room.players.forEach((player) => {
        if (imposters.has(player)) {
          player.ws.send(
            JSON.stringify({
              type: "gameStart",
              word: null,
              imposters: imposterNames,
              genre: data.genreCheck ? chosenGenre : null,
            })
          );
        } else {
          player.ws.send(
            JSON.stringify({
              type: "gameStart",
              word: chosenWord,
              genre: data.genreCheck ? chosenGenre : null,
            })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    // Remove the player from all rooms
    Object.keys(rooms).forEach((roomId) => {
      rooms[roomId].players = rooms[roomId].players.filter(
        (player) => player.ws !== ws
      );

      // If the admin leaves, assign a new admin
      if (ws === rooms[roomId].admin?.ws && rooms[roomId].players.length > 0) {
        rooms[roomId].admin = rooms[roomId].players[0]; // The next player becomes the admin
        rooms[roomId].admin.isAdmin = true;
        rooms[roomId].admin.ws.send(
          JSON.stringify({ type: "joined", isAdmin: true })
        );
      }

      // Update player count and player list for all players in the room
      updatePlayerCount(roomId);
    });
  });
});

console.log("Server Started");
