import { EventEmitter } from "eventemitter3";
import { nextIntInRange } from "@aicacia/rand";
export const DEFAULT_SYNC_MS = 60_000;
export const DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 3 * 60_000;
export class Mesh extends EventEmitter {
    peer;
    maxConnections = 6;
    syncMS = DEFAULT_SYNC_MS;
    messageLastSeenDeleteMS = DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS;
    messageId = 0;
    messages = new Map();
    constructor(peer, options = {}) {
        super();
        this.peer = peer;
        this.peer.on("data", this.onData);
        this.peer.on("discover", this.onDiscover);
        this.peer.once("connect", this.onSync);
        if (typeof options.maxConnections === "number" &&
            options.maxConnections > 1) {
            this.maxConnections = options.maxConnections;
        }
        if (typeof options.syncMS === "number" && options.syncMS > 5000) {
            this.syncMS = options.syncMS;
        }
        if (typeof options.messageLastSeenDeleteMS === "number") {
            this.messageLastSeenDeleteMS = options.messageLastSeenDeleteMS;
        }
        this.sync();
    }
    getPeer() {
        return this.peer;
    }
    broadcast(payload) {
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
        if (this.needsConnection()) {
            this.peer.connectToInBackground(id);
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
