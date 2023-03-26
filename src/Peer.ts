import { EventEmitter } from "eventemitter3";
import type { SimplePeerData, Instance } from "simple-peer";
import type SimplePeer from "simple-peer";
import type { Socket } from "socket.io-client";

export type IPeerData = SimplePeerData;
export type PeerConnection = Instance;

export interface IPeerEvents {
  join(this: Peer, id: string): void;
  announce(this: Peer, id: string): void;
  connect(this: Peer, id: string): void;
  disconnect(this: Peer): void;
  error(this: Peer, error: Error): void;
  connection(this: Peer, connection: PeerConnection, id: string): void;
  disconnection(this: Peer, connection: PeerConnection, id: string): void;
  data(this: Peer, data: IPeerData, from: string): void;
}

export class Peer extends EventEmitter<IPeerEvents> {
  protected socket: Socket;
  protected readonly connections: Map<string, PeerConnection> = new Map();
  protected SimplePeer: SimplePeer.SimplePeer;

  constructor(socket: Socket, SimplePeerClass: SimplePeer.SimplePeer) {
    super();
    this.SimplePeer = SimplePeerClass;
    this.socket = socket;
    this.socket.on("signal", this.onSignal);
    this.socket.on("connect", this.onConnect);
    this.socket.on("disconnect", this.onDisonnect);
    this.socket.on("join", this.onJoin);
    this.socket.on("announce", this.onAnnounce);
    this.socket.on("leave", this.onLeave);
  }

  getId() {
    return this.socket.id;
  }
  isConnected() {
    return this.socket.connected;
  }
  connected() {
    return waitFor(this.socket);
  }

  getConnections(): ReadonlyMap<string, PeerConnection> {
    return this.connections;
  }

  private onSignal = (data: RTCSessionDescription, from: string) => {
    let connection = this.connections.get(from);

    if (data.type === "offer" && (connection as any)?.initiator) {
      this.disconnectFrom(from, false);
      connection = undefined;
    }
    if (!connection) {
      connection = this.createConnection(from, false);
    }

    if (!connection.destroyed) {
      connection.signal(data);
    }
  };

  private onConnect = () => {
    this.emit("connect", this.socket.id);
  };
  private onDisonnect = () => {
    this.emit("disconnect");
    for (const [id, connection] of this.connections.entries()) {
      this.emit("disconnection", connection, id);
      connection.destroy();
    }
    this.connections.clear();
  };
  private onJoin = (id: string) => {
    if (id !== this.socket.id) {
      this.emit("join", id);
    }
  };
  private onAnnounce = (id: string) => {
    if (id !== this.socket.id) {
      this.emit("announce", id);
    }
  };
  private onLeave = (id: string, _reason: string) => {
    this.disconnectFrom(id);
  };

  send(to: string, data: IPeerData) {
    const connection = this.connections.get(to);
    if (connection?.connected) {
      connection.send(data);
    }
    return this;
  }
  broadcast(data: IPeerData) {
    for (const connection of this.connections.values()) {
      if (connection.connected) {
        connection.send(data);
      }
    }
    return this;
  }
  announce() {
    this.socket.emit("announce");
    return this;
  }

  get(id: string) {
    return this.connections.get(id);
  }
  connectToInBackground(id: string) {
    this.getOrCreateConnection(id, true);
    return this;
  }
  connectTo(id: string) {
    return waitFor(this.getOrCreateConnection(id, true));
  }
  disconnectFrom(id: string, emit = true) {
    const connection = this.connections.get(id);

    if (connection) {
      if (emit) {
        this.emit("disconnection", connection, id);
      }
      this.connections.delete(id);
      connection.destroy();
    }

    return this;
  }

  private getOrCreateConnection(id: string, initiator: boolean) {
    const connection = this.connections.get(id);

    if (connection) {
      return connection;
    } else {
      return this.createConnection(id, initiator);
    }
  }

  private createConnection(id: string, initiator: boolean) {
    const connection = new this.SimplePeer({
      initiator,
      trickle: false,
    });

    connection.on("signal", (data: RTCSessionDescription) => {
      this.socket.emit("signal", id, data);
    });
    connection.on("data", (data: IPeerData) => {
      this.emit("data", data, id);
    });
    connection.on("error", (error) => {
      this.disconnectFrom(id);
      this.emit("error", error);
    });
    connection.on("connect", () => {
      this.emit("connection", connection, id);
    });
    connection.on("disconnect", () => {
      this.disconnectFrom(id);
    });

    this.connections.set(id, connection);

    return connection;
  }
}

export function waitFor<T extends Socket | Instance>(object: T) {
  return new Promise<T>((resolve, reject) => {
    if (object.connected) {
      resolve(object);
    } else {
      function onConnect() {
        removeListeners();
        resolve(object);
      }
      function onClose() {
        removeListeners();
        reject();
      }
      function onError(error?: Error) {
        removeListeners();
        reject(error);
      }
      function removeListeners() {
        object.off("connect", onConnect);
        object.off("disconnect", onClose);
        object.off("error", onError);
      }
      object.once("connect", onConnect);
      object.once("disconnect", onClose);
      object.once("error", onError);
    }
  });
}
