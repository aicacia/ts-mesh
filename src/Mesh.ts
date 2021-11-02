import { EventEmitter } from "eventemitter3";
import { Buffer } from "buffer";
import type { IPeerData } from "./Peer";
import type { Peer } from "./Peer";
import { nextIntInRange, fromArray } from "@aicacia/rand";

export const DEFAULT_SYNC_MS = 60_000;
export const DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 3 * 60_000;

export interface IMeshEvents {
  data(data: any, from: string): void;
}

export interface IMeshOptions {
  maxConnections?: number;
  syncMS?: number;
  messageLastSeenDeleteMS?: number;
}

export class Mesh extends EventEmitter<IMeshEvents> {
  protected peer: Peer;
  protected maxConnections = 6;
  protected syncMS = DEFAULT_SYNC_MS;
  protected messageLastSeenDeleteMS = DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS;
  protected messageId = 0;
  protected messages: Map<string, number> = new Map();
  protected payloadsToSend: Array<any> = [];

  constructor(peer: Peer, options: IMeshOptions = {}) {
    super();
    this.peer = peer;
    this.peer.on("data", this.onData);
    this.peer.on("join", this.onDiscover);
    this.peer.on("announce", this.onDiscover);
    this.peer.on("connection", this.onConnection);
    this.peer.once("connect", this.onSync);
    if (
      typeof options.maxConnections === "number" &&
      options.maxConnections > 0
    ) {
      this.maxConnections = options.maxConnections;
    }
    if (typeof options.syncMS === "number" && options.syncMS > 5000) {
      this.syncMS = options.syncMS;
    }
    if (
      typeof options.messageLastSeenDeleteMS === "number" &&
      options.messageLastSeenDeleteMS > 0
    ) {
      this.messageLastSeenDeleteMS = options.messageLastSeenDeleteMS;
    }
    this.sync();
  }

  getPeer() {
    return this.peer;
  }
  broadcast(payload: any) {
    if (this.peer.getConnections().size === 0) {
      this.payloadsToSend.push(payload);
    } else {
      return this.broadcastInternal(payload);
    }
  }

  private broadcastInternal(payload: any) {
    const from = this.peer.getId(),
      id = this.messageId++,
      messageId = `${from}-${id}`;

    this.messages.set(messageId, Date.now());
    this.peer.broadcast(
      JSON.stringify({
        id,
        from,
        payload,
      })
    );
    return this;
  }

  private needsConnection() {
    return this.peer.getConnections().size < this.maxConnections;
  }

  private onData = (data: IPeerData, _from: string) => {
    if (typeof data === "string" || Buffer.isBuffer(data)) {
      const json = JSON.parse(data.toString()),
        messageId = `${json.from}-${json.id}`;

      if (!this.messages.has(messageId)) {
        this.messages.set(messageId, Date.now());
        this.peer.broadcast(data);
        this.emit("data", json.payload, json.from);
      }
    }
  };
  private onDiscover = (id: string) => {
    if (this.peer.getConnections().has(id)) {
      return;
    }
    if (this.needsConnection()) {
      this.peer.connectToInBackground(id);
    } else {
      this.peer.connectTo(id).then(() => {
        const peers = Array.from(this.peer.getConnections().keys());

        if (peers.length > 1) {
          this.peer.disconnectFrom(getRandomIdExceptFor(peers, id));
        }
      });
    }
  };

  private onConnection = () => {
    if (this.payloadsToSend.length) {
      this.payloadsToSend.forEach((payload) => this.broadcastInternal(payload));
      this.payloadsToSend.length = 0;
    }
  };

  private onSync = () => {
    if (this.needsConnection()) {
      this.peer.announce();
    }
    this.cleanOldMessages();
    this.sync();
  };

  private sync() {
    setTimeout(this.onSync, nextIntInRange(this.syncMS * 0.5, this.syncMS));
  }

  private cleanOldMessages() {
    if (this.messages.size) {
      const now = Date.now();

      for (const [messageId, received] of this.messages.entries()) {
        if (now - received > this.messageLastSeenDeleteMS) {
          this.messages.delete(messageId);
        }
      }
    }
  }
}

function getRandomIdExceptFor(ids: string[], id: string): string {
  const randomId = fromArray(ids).unwrap();

  if (randomId === id) {
    return getRandomIdExceptFor(ids, id);
  } else {
    return randomId;
  }
}
