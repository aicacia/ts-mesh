import { EventEmitter } from "eventemitter3";
import { Buffer } from "buffer";
import { nextIntInRange, fromArray } from "@aicacia/rand";
export const DEFAULT_SYNC_MS = 60_000;
export const DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 3 * 60_000;
export class Mesh extends EventEmitter {
    peer;
    maxConnections = 6;
    syncMS = DEFAULT_SYNC_MS;
    messageLastSeenDeleteMS = DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS;
    messageId = 0;
    messages = new Map();
    payloadsToSend = [];
    constructor(peer, options = {}) {
        super();
        this.peer = peer;
        this.peer.on("data", this.onData);
        this.peer.on("join", this.onDiscover);
        this.peer.on("announce", this.onDiscover);
        this.peer.on("connection", this.onConnection);
        this.peer.once("connect", this.onSync);
        if (typeof options.maxConnections === "number" &&
            options.maxConnections > 0) {
            this.maxConnections = options.maxConnections;
        }
        if (typeof options.syncMS === "number" && options.syncMS > 5000) {
            this.syncMS = options.syncMS;
        }
        if (typeof options.messageLastSeenDeleteMS === "number" &&
            options.messageLastSeenDeleteMS > 0) {
            this.messageLastSeenDeleteMS = options.messageLastSeenDeleteMS;
        }
        this.sync();
    }
    getPeer() {
        return this.peer;
    }
    broadcast(payload) {
        if (this.peer.getConnections().size === 0) {
            this.payloadsToSend.push(payload);
        }
        else {
            return this.broadcastInternal(payload);
        }
    }
    broadcastInternal(payload) {
        const from = this.peer.getId(), id = this.messageId++, messageId = `${from}-${id}`;
        this.messages.set(messageId, Date.now());
        this.peer.broadcast(JSON.stringify({
            id,
            from,
            payload,
        }));
        return this;
    }
    needsConnection() {
        return this.peer.getConnections().size < this.maxConnections;
    }
    onData = (data, _from) => {
        if (typeof data === "string" || Buffer.isBuffer(data)) {
            const json = JSON.parse(data.toString()), messageId = `${json.from}-${json.id}`;
            if (!this.messages.has(messageId)) {
                this.messages.set(messageId, Date.now());
                this.peer.broadcast(data);
                this.emit("data", json.payload, json.from);
            }
        }
    };
    onDiscover = (id) => {
        if (this.peer.getConnections().has(id)) {
            return;
        }
        if (this.needsConnection()) {
            this.peer.connectToInBackground(id);
        }
        else {
            this.peer.connectTo(id).then(() => {
                const peers = Array.from(this.peer.getConnections().keys());
                if (peers.length > 1) {
                    this.peer.disconnectFrom(getRandomIdExceptFor(peers, id));
                }
            });
        }
    };
    onConnection = () => {
        if (this.payloadsToSend.length) {
            this.payloadsToSend.forEach((payload) => this.broadcastInternal(payload));
            this.payloadsToSend.length = 0;
        }
    };
    onSync = () => {
        if (this.needsConnection()) {
            this.peer.announce();
        }
        this.cleanOldMessages();
        this.sync();
    };
    sync() {
        setTimeout(this.onSync, nextIntInRange(this.syncMS * 0.5, this.syncMS));
    }
    cleanOldMessages() {
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
function getRandomIdExceptFor(ids, id) {
    const randomId = fromArray(ids).unwrap();
    if (randomId === id) {
        return getRandomIdExceptFor(ids, id);
    }
    else {
        return randomId;
    }
}
