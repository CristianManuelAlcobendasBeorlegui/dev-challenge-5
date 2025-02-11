// === CONSTANTS === //
const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const app = express();
const server = createServer(app);
const io = new Server(
  server,
  {
    connectionStateRecovery: {}
  }
);
const crypto = require("crypto");
const rooms = {};
const players = {};
let roomUUID = crypto.randomUUID();
const cardTypes = ["clubs", "diamonds", "hearts", "spades"];
const cardNumericValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// === SERVER === //
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

app.use(express.static(join(__dirname, "public")));

// === ROUTES === //
app.get("/", (request, response) => {
  response.sendFile(join(__dirname, "public/index.html"));
});

// === SOCKET IO === //
io.on("connect", async (socket) => {
  // Check if room does not exists
  if (!existsRoom(roomUUID)) {
    createRoom(roomUUID);
  }

  if (getRoomPlayers(roomUUID) >= 2) {
    roomUUID = crypto.randomUUID();
    createRoom(roomUUID);
  }

  joinRoom(roomUUID, socket.id);
  socket.join(roomUUID);
  let cardsHand = getCardsHand(roomUUID);
  socket.emit(
    "cards hand",
    {
      status: "ok",
      cards: cardsHand
    });

  let roomStatus = {};
  if (getRoomPlayers(roomUUID) < 2) {
    roomStatus = {
      status: "waiting",
      message: "Waiting to another player",
      players: rooms[roomUUID].players
    };
  } else {
    roomStatus = {
      status: "ok",
      message: "All players connected",
      players: rooms[roomUUID].players
    };
  }

  io.to(roomUUID).emit("room status", roomStatus);

  socket.on("selected card", (playerId, card) => {
    let roomUUID = players[playerId].room;
    rooms[roomUUID].data.selectedCards[playerId] = card;

    let player1UUID = (rooms[roomUUID].players[Object.keys(rooms[roomUUID].players)[0]].number == 1)
      ? Object.keys(rooms[roomUUID].players)[0]
      : Object.keys(rooms[roomUUID].players)[1];
    let player2UUID = (rooms[roomUUID].players[Object.keys(rooms[roomUUID].players)[0]].number == 2)
      ? Object.keys(rooms[roomUUID].players)[0]
      : Object.keys(rooms[roomUUID].players)[1];

    if (Object.keys(rooms[roomUUID].data.selectedCards).length == 2) {
      let player1CardNumber = getCardNumericValue(rooms[roomUUID].data.selectedCards[player1UUID].split("-")[1]);
      let player2CardNumber = getCardNumericValue(rooms[roomUUID].data.selectedCards[player2UUID].split("-")[1]);

      if (player1CardNumber < player2CardNumber) {
        io.to(roomUUID).emit("results", {
          status: "ok",
          player1: {
            uuid: player1UUID,
            status: "lost"
          },
          player2: {
            uuid: player2UUID,
            status: "win"
          },
          message: "Player 2 card [" + rooms[roomUUID].data.selectedCards[player2UUID]?.split("-").reverse().join(" ").toUpperCase() + "] is higher than Player 1 card [" + rooms[roomUUID].data.selectedCards[player1UUID]?.split("-").reverse().join(" ").toUpperCase() + "]"
        });
      } else if (player1CardNumber > player2CardNumber) {
        io.to(roomUUID).emit("results", {
          status: "ok",
          player1: {
            uuid: player1UUID,
            status: "win"
          },
          player2: {
            uuid: player2UUID,
            status: "lost"
          },
          message: "Player 1 card [" + rooms[roomUUID].data.selectedCards[player1UUID]?.split("-").reverse().join(" ").toUpperCase() + "] is higher than Player 2 card [" + rooms[roomUUID].data.selectedCards[player2UUID]?.split("-").reverse().join(" ").toUpperCase() + "]"
        });
      } else {
        io.to(roomUUID).emit("results", {
          status: "ok",
          player1: {
            uuid: player1UUID,
            status: "draw"
          },
          player2: {
            uuid: player2UUID,
            status: "draw"
          },
          message: "Both players have chosen the same card [" + (rooms[roomUUID].data.selectedCards[player1UUID]?.split("-").reverse()[0] ?? "") + "]."
        });
      }
      io.to(roomUUID).emit("new game", {});
      rooms[roomUUID].data.selectedCards = {};
    } else {
      socket.emit("room status", {
        status: "waiting",
        message: "Waiting for " + rooms[roomUUID].players[((player1UUID == socket.id) ? player2UUID : player1UUID)].name,
        players: rooms[roomUUID].players
      });
    }
  });

  socket.on("disconnect", () => {
    let playerName = rooms[roomUUID].players[socket.id]?.name ?? "Player ??";
    delete rooms[roomUUID].players[socket.id];
    delete players[socket.id];

    io.to(roomUUID).emit("room status", {
      status: "waiting",
      message: playerName + " has disconnected.",
      players: rooms[roomUUID].players
    });

    setTimeout(() => {
      io.to(roomUUID).emit("room status", {
        status: "waiting",
        message: "Waiting to another player",
        players: rooms[roomUUID].players
      })
    }, 1000);

    console.log(rooms, players);
  });
});

// === METHODS === //

/**
 * Create a room.
 * 
 * @param { string } roomUUID
 */
function createRoom(roomUUID) {
  rooms[roomUUID] = {
    players: {},
    data: {
      status: "waiting",
      maxCardsPerPlayer: 5,
      cardCount: 0,
      cardsDeck: getDeckOfCards(),
      selectedCards: {}
    }
  };
}

/**
 * Return a boolean indicating if given room ID exists.
 * 
 * @param   { string }  roomUUID
 * @return  { boolean } TRUE if room UUID exists.
 */
function existsRoom(roomUUID) {
  return rooms[roomUUID] != null;
}

/**
 * Return how many players are in a room.
 * 
 * @param   { string } roomUUID
 * @return  { integer } Total players in room. 
 */
function getRoomPlayers(roomUUID) {
  if (rooms[roomUUID] == null) throw "Can't get room player's because room UUID (" + roomUUID + ") does not exists.";
  return Object.keys(rooms[roomUUID].players).length;
}

/**
 * Join a player in a room.
 * 
 * @param { string } roomUUID
 * @param { string } playerID
 */
function joinRoom(roomUUID, playerID) {
  if (rooms[roomUUID] == null) throw "Can't join player (" + playerID + ") to room because room UUID (" + roomUUID + ") does not exists.";
  let playerNumber = (Object.keys(rooms[roomUUID].players).length == 0)
    ? 1
    : ((rooms[roomUUID].players[Object.keys(rooms[roomUUID].players)[0]]).number == 1)
      ? 2
      : 1;

  rooms[roomUUID].players[playerID] = {
    number: playerNumber,
    name: "Player " + playerNumber
  }
  players[playerID] = {
    room: roomUUID,
    data: {}
  };
}

/**
 * Return cards deck.
 */
function getDeckOfCards() {
  let deckCards = [];

  cardTypes.forEach(cardType => {
    cardNumericValues.forEach(cardNumericValue => {
      deckCards.push(cardType + "-" + getCardTextValue(cardNumericValue));
    });
  });

  return shuffleArray(deckCards);
}

/**
 * Return text value of card number.
 * 
 * @param   { integer } cardNumber - Card number between 1 and 14.
 * @return  { string } Text card value, if number is higher than 10 it's value will be 
 *          changed to text. [11 => J, 12 => Q, 13 => K, 14 => As]
 */
function getCardTextValue(cardNumber) {
  if (cardNumber <= 0 && cardNumber >= 15) throw "Given card number (" + cardNumber + ") is not valid.";

  switch (cardNumber) {
    case 11:
      return "j";
    case 12:
      return "q";
    case 13:
      return "k";
    case 14:
      return "as";
    default:
      return parseInt(cardNumber);
  }
}

/**
 * Return card numeric value.
 * 
 * @param { string } cardTextValue - Card value with numeric values and 'J', 'Q',
 * 'K', and 'AS'
 */
function getCardNumericValue(cardTextValue) {
  switch (cardTextValue) {
    case "j":
      return 11;

    case "q":
      return 12;

    case "k":
      return 13;

    case "as":
      return 14;

    default:
      return parseInt(cardTextValue);
  }
}

/**
 * Shuffle an array.
 * 
 * @param   { array } array
 * @return  { arrray } Array shuffled
 */
function shuffleArray(array) {
  return array.sort(function () { return 0.5 - Math.random() });
}

/**
 * Return an array of player cards hand.
 * 
 * @param   { string } roomUUID
 * @return  { array } An array with player cards.
 */
function getCardsHand(roomUUID) {
  let cardsHand = [];
  let maxCards = rooms[roomUUID].data.cardCount + rooms[roomUUID].data.maxCardsPerPlayer;

  rooms[roomUUID].data.cardCount = (maxCards >= rooms[roomUUID].data.cardsDeck.length)
    ? 0
    : rooms[roomUUID].data.cardCount;
  rooms[roomUUID].data.cardsDeck = (maxCards >= rooms[roomUUID].data.cardsDeck.length)
    ? shuffleArray(rooms[roomUUID].data.cardsDeck)
    : rooms[roomUUID].data.cardsDeck;
  maxCards = (maxCards >= rooms[roomUUID].data.cardsDeck.length)
    ? 5
    : maxCards;

  for (
    ; rooms[roomUUID].data.cardCount < maxCards
    && rooms[roomUUID].data.cardCount < rooms[roomUUID].data.cardsDeck.length
    ; rooms[roomUUID].data.cardCount++
  ) {
    cardsHand.push(rooms[roomUUID].data.cardsDeck[rooms[roomUUID].data.cardCount]);
  }

  return cardsHand;
}