import type { IPeerData } from "../src";
import { Mesh, Peer } from "../src";

async function onLoad() {
  const peer = new Peer({
      url: "ws://localhost:8080/example-namespace",
    }),
    mesh = new Mesh(peer, {
      maxConnections: 2,
      syncMS: 10000,
      messageLastSeenDeleteMS: 5000,
    });

  let currentId: string;

  document.getElementById("send").addEventListener("click", async () => {
    const input = document.getElementById("message") as HTMLInputElement,
      message = input.value;

    if (message) {
      mesh.broadcast(message);
      onMessage(message, "me");
      input.value = "";
    }
  });

  function onMessage(mesage: IPeerData, from: string) {
    const li = document.createElement("li");
    li.innerHTML = `${from}: ${mesage}`;
    document.getElementById("messages").appendChild(li);
  }

  mesh.on("data", (data, from) => {
    onMessage(data, from);
  });
  mesh
    .getPeer()
    .on("connection", (_connection, id) => {
      console.log("connection", id);
    })
    .on("disconnection", (_connection, id) => {
      console.log("disconnection", id);
    })
    .on("connect", (id) => {
      currentId = id;
      document.getElementById("peer-id").innerText = currentId;
    });
}

window.addEventListener("load", onLoad);
