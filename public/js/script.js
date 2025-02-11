// === STRICT MODE === //
"use strict";

// === CONSTANTS === //
const socket = io({});
const CSS_CLASS = {
  active: "active",
  hidden: "hidden"
};
let header;
let headerPlayerName;
let headerPlayer1Item;
let headerPlayer1Status;
let headerPlayer2Item;
let headerPlayer2Status;
let cards;
let errorMessage;
let buttonConfirmCard;

// === SOCKET IO === //

socket.on("cards hand", (data) => {
  // Remove current cards content
  cards.innerHTML = "";

  console.log(data.cards);

  // Add card items
  data.cards.forEach(card => {
    // Define DOM elements
    let cardItem = document.createElement("div");
    let cardInputField = document.createElement("input");
    let cardLabel = document.createElement("label");

    // Set attributes
    cardItem.setAttribute("class", "section__card section__card--" + card + " section__card--flipped");

    cardInputField.setAttribute("class", "section__card-input-field hidden");
    cardInputField.setAttribute("type", "radio");
    cardInputField.setAttribute("name", "card");
    cardInputField.setAttribute("id", "card--" + card);
    cardInputField.setAttribute("value", card);

    cardLabel.setAttribute("class", "section__card-label");
    cardLabel.setAttribute("for", "card--" + card);

    // Append child nodes
    cards.appendChild(cardItem);
    cardItem.appendChild(cardInputField);
    cardItem.appendChild(cardLabel);
  });
});

socket.on("room status", (data) => {
  console.log(data);
  if (data.status == "waiting") {
    showModal(data.message);
  } else {
    showModal(data.message);
    setTimeout(hideModal, 1000);
  }

  if (Object.keys(data.players).length < 2) {
    let playerNumber = data.players[Object.keys(data.players)[0]].number;
    updatePlayerStatus(playerNumber, "online");
    updatePlayerStatus((playerNumber == 1) ? 2 : 1, "offline");
  } else {
    updatePlayerStatus(1, "online");
    updatePlayerStatus(2, "online");
  }

  headerPlayerName.innerText = data.players[socket.id].name + " (You)";
});

socket.on("results", (data) => {
  let playerStatus = (data.player1.uuid == socket.id)
    ? data.player1.status
    : data.player2.status;
  
  hideModal();

  window.alert(`
    [Game results]\n
    - Status: ${playerStatus}
    - Description: ${data.message}
  `);
});

socket.on("new game", (data) => {
  window.location.reload();
});

// === EVENT LISTENERS === //
window.addEventListener("load", init);

// === METHODS === //

// Init function
function init() {
  // Link DOM elements
  header = document.querySelector(".section__header");
  headerPlayerName = header.querySelector(".section__heading--player-name");
  headerPlayer1Item = header.querySelector(".section__heading-player--1");
  headerPlayer1Status = headerPlayer1Item.querySelector(".section__heading-player-status");
  headerPlayer2Item = header.querySelector(".section__heading-player--2");
  headerPlayer2Status = headerPlayer2Item.querySelector(".section__heading-player-status");
  cards = document.querySelector(".section__cards");
  errorMessage = document.querySelector(".section__error-message");
  buttonConfirmCard = document.querySelector(".section__button--confirm-card");

  // Add event listener
  buttonConfirmCard.addEventListener("click", () => {
    let checkedItem = document.querySelector(":checked");
    if (!(checkedItem instanceof HTMLElement)) {
      errorMessage.innerText = "Choose a card.";
    } else {
      checkedItem.parentNode.classList.remove("section__card--flipped");
      errorMessage.innerText = "";
      cards.querySelectorAll(".section__card").forEach(card => {
        card.classList.add("lock");
      });

      setTimeout(() => {
        socket.emit("selected card", socket.id, checkedItem.value);
      }, 1000);
    }
  });

  // Execute methods
  showModal("Loading content");
}

/**
 * Show modal
 * 
 * @param { string } text
 */
function showModal(text) {
  // Link DOM elements
  let activeModal = document.querySelector(".modal.active");
  let infoModal = document.querySelector(".modal--info");
  let modalText = infoModal.querySelector(".modal__information");

  if (activeModal instanceof HTMLElement) {
    activeModal.classList.remove(CSS_CLASS.active);
  }

  infoModal.classList.add(CSS_CLASS.active);
  modalText.innerText = text;
}

/**
 * Hide modal.
 */
function hideModal() {
  let activeModal = document.querySelector(".modal.active");

  if (activeModal instanceof HTMLElement) {
    activeModal.classList.remove(CSS_CLASS.active);
  }
}

/**
 * Update player status.
 * 
 * @param { string } player
 * @param { string } status
 */
function updatePlayerStatus(playerNumber, status) {
  if (playerNumber == 1) {
    headerPlayer1Status.classList.remove("section__heading-player-status--offline");
    headerPlayer1Status.classList.remove("section__heading-player-status--online");
    headerPlayer1Status.classList.add("section__heading-player-status--" + status);
    headerPlayer1Status.setAttribute("title", status);
  } else {
    headerPlayer2Status.classList.remove("section__heading-player-status--offline");
    headerPlayer2Status.classList.remove("section__heading-player-status--online");
    headerPlayer2Status.classList.add("section__heading-player-status--" + status);
    headerPlayer2Status.setAttribute("title", status);
  }
}