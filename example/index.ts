import SimplePeer from "simple-peer";
import { io } from "socket.io-client";
import { Mesh, Peer } from "../src";

declare global {
  interface Window {
    mesh: Mesh;
    peer: Peer;
  }
}

async function onLoad() {
  const peer = new Peer(
      io("wss://mesh.aicacia.com/mesh-example", {
        transports: ["websocket"],
      }),
      SimplePeer
    ),
    mesh = new Mesh(peer);

  window.peer = peer;
  window.mesh = mesh;

  let currentId: string;

  document.getElementById("send")?.addEventListener("click", async () => {
    const input = document.getElementById("message") as HTMLInputElement,
      message = input.value;

    if (message) {
      mesh.broadcast(message);
      onMessage(message, "me");
      input.value = "";
    }
  });

  function onMessage(mesage: any, from: string) {
    const li = document.createElement("li");
    li.innerHTML = `${from}: ${mesage}`;
    document.getElementById("messages")?.appendChild(li);
  }

  mesh.on("data", onMessage);
  peer
    .on("connection", (_connection, id) => {
      console.log("connection", id);
    })
    .on("disconnection", (_connection, id) => {
      console.log("disconnection", id);
    })
    .on("connect", (id) => {
      currentId = id;
      const peerIdElement = document.getElementById("peer-id") as HTMLElement;
      peerIdElement.innerText = currentId;
    });
}

window.addEventListener("load", onLoad);
