import { EventEmitter } from "eventemitter3";
import { Buffer } from "buffer";
export const DEFAULT_SYNC_MS = 30_000;
export const DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 60_000;
export const DEFAULT_REPLACE_OLD_PEER_MS = 60_000;
export class Mesh extends EventEmitter {
    peer;
    maxConnections = 6;
    syncMS = DEFAULT_SYNC_MS;
    messageLastSeenDeleteMS = DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS;
    replaceOldPeerMS = DEFAULT_REPLACE_OLD_PEER_MS;
    messageId = 0;
    messages = new Map();
    connections = new Map();
    payloadsToSend = [];
    syncTimeoutId;
    constructor(peer, options = {}) {
        super();
        this.peer = peer;
        this.peer.on("data", this.onData);
        this.peer.on("join", this.onDiscover);
        this.peer.on("announce", this.onDiscover);
        this.peer.on("connection", this.onConnection);
        this.peer.on("disconnection", this.onDisconnection);
        this.peer.on("connect", this.sync);
        this.peer.on("disconnect", this.onDisconnect);
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
        if (typeof options.replaceOldPeerMS === "number" &&
            options.replaceOldPeerMS > 0) {
            this.replaceOldPeerMS = options.replaceOldPeerMS;
        }
        if (this.peer.isConnected()) {
            this.sync();
        }
    }
    getPeer() {
        return this.peer;
    }
    broadcast(payload) {
        if (this.connections.size === 0) {
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
        return this.connections.size < this.maxConnections;
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
        if (!this.peer.getConnections().has(id)) {
            if (this.needsConnection()) {
                this.peer.connectToInBackground(id);
            }
            else {
                const peer = getOldestPeerId(this.connections.entries());
                if (peer) {
                    const [oldestPeerId, connectedAt] = peer;
                    if (connectedAt < Date.now() - this.replaceOldPeerMS) {
                        this.peer
                            .connectTo(id)
                            .then(() => this.peer.disconnectFrom(oldestPeerId));
                    }
                }
            }
        }
    };
    onConnection = (_connection, id) => {
        if (this.payloadsToSend.length) {
            this.payloadsToSend.forEach((payload) => this.broadcastInternal(payload));
            this.payloadsToSend.length = 0;
        }
        this.connections.set(id, Date.now());
    };
    onDisconnection = (_connection, id) => {
        if (this.needsConnection()) {
            this.peer.announce();
        }
        this.connections.delete(id);
    };
    onDisconnect = () => {
        this.connections.clear();
        if (this.syncTimeoutId) {
            clearTimeout(this.syncTimeoutId);
            this.syncTimeoutId = undefined;
        }
    };
    onSync = () => {
        if (this.needsConnection()) {
            this.peer.announce();
        }
        this.cleanOldMessages();
        this.syncTimeoutId = undefined;
        this.sync();
    };
    sync = () => {
        this.syncTimeoutId = setTimeout(this.onSync, this.syncMS * 0.5 + Math.random() * this.syncMS * 0.5);
    };
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
function getOldestPeerId(peers) {
    let minConnectedAt = Number.MAX_SAFE_INTEGER;
    let oldestPeer;
    for (const peer of peers) {
        const connectedAt = peer[1];
        if (connectedAt < minConnectedAt) {
            minConnectedAt = connectedAt;
            oldestPeer = peer;
        }
    }
    return oldestPeer;
}
