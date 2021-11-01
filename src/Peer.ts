import { EventEmitter } from "eventemitter3";
import type { SimplePeerData, Instance } from "simple-peer";
import type SimplePeer from "simple-peer";
import { io, Socket } from "socket.io-client";

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

export interface IPeerOptions {
  SimplePeer: SimplePeer.SimplePeer;
  origin?: string;
  namespace?: string;
}

export class Peer extends EventEmitter<IPeerEvents> {
  protected socket: Socket;
  protected readonly connections: Map<string, PeerConnection> = new Map();
  protected SimplePeer: SimplePeer.SimplePeer;

  constructor(options: IPeerOptions) {
    super();
    this.SimplePeer = options.SimplePeer;
    this.socket = io(
      `${options.origin || "wss://mesh.aicacia.com"}/${options.namespace || ""}`
    );
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
    return waitForSocket(this.socket);
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
    const connection = this.getOrCreateConnection(id, true);

    return new Promise<PeerConnection>((resolve, reject) => {
      if (connection.connected) {
        resolve(connection);
      } else {
        const onConnect = () => {
          removeListeners();
          resolve(connection);
        };
        const onClose = () => {
          removeListeners();
          reject();
        };
        const onError = (error?: Error) => {
          removeListeners();
          reject(error);
        };
        const removeListeners = () => {
          connection.off("connect", onConnect);
          connection.off("disconnect", onClose);
          connection.off("error", onError);
        };
        connection.once("connect", onConnect);
        connection.once("disconnect", onClose);
        connection.once("error", onError);
      }
    });
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

export function waitForSocket(socket: Socket) {
  return new Promise<Socket>((resolve, reject) => {
    if (socket.connected) {
      resolve(socket);
    } else {
      const onConnect = () => {
        removeListeners();
        resolve(socket);
      };
      const onClose = () => {
        removeListeners();
        reject();
      };
      const onError = (error?: Error) => {
        removeListeners();
        reject(error);
      };
      const removeListeners = () => {
        socket.off("connect", onConnect);
        socket.off("disconnect", onClose);
        socket.off("error", onError);
      };
      socket.once("connect", onConnect);
      socket.once("disconnect", onClose);
      socket.once("error", onError);
    }
  });
}
