"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mesh = exports.DEFAULT_REPLACE_OLD_PEER_MS = exports.DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = exports.DEFAULT_SYNC_MS = void 0;
const eventemitter3_1 = require("eventemitter3");
const buffer_1 = require("buffer");
exports.DEFAULT_SYNC_MS = 60000;
exports.DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 5 * 60000;
exports.DEFAULT_REPLACE_OLD_PEER_MS = 5 * 60000;
class Mesh extends eventemitter3_1.EventEmitter {
    constructor(peer, options = {}) {
        super();
        this.maxConnections = 6;
        this.syncMS = exports.DEFAULT_SYNC_MS;
        this.messageLastSeenDeleteMS = exports.DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS;
        this.replaceOldPeerMS = exports.DEFAULT_REPLACE_OLD_PEER_MS;
        this.messageId = 0;
        this.messages = new Map();
        this.connections = new Map();
        this.payloadsToSend = [];
        this.onData = (data, _from) => {
            if (typeof data === "string" || buffer_1.Buffer.isBuffer(data)) {
                const json = JSON.parse(data.toString()), messageId = `${json.from}-${json.id}`;
                if (!this.messages.has(messageId)) {
                    this.messages.set(messageId, Date.now());
                    this.peer.broadcast(data);
                    this.emit("data", json.payload, json.from);
                }
            }
        };
        this.onDiscover = (id) => {
            if (!this.peer.getConnections().has(id)) {
                let shouldConnect = false;
                if (this.needsConnection()) {
                    shouldConnect = true;
                }
                else {
                    const peer = getOldestPeerId(this.connections.entries());
                    if (peer) {
                        const [oldestPeerId, connectedAt] = peer;
                        if (connectedAt < Date.now() - this.replaceOldPeerMS) {
                            this.peer.disconnectFrom(oldestPeerId);
                            shouldConnect = true;
                        }
                    }
                }
                if (shouldConnect) {
                    this.peer.connectToInBackground(id);
                }
            }
        };
        this.onConnection = (_connection, id) => {
            if (this.payloadsToSend.length) {
                this.payloadsToSend.forEach((payload) => this.broadcastInternal(payload));
                this.payloadsToSend.length = 0;
            }
            this.connections.set(id, Date.now());
        };
        this.onDisconnection = (_connection, id) => {
            if (this.needsConnection()) {
                this.peer.announce();
            }
            this.connections.delete(id);
        };
        this.onDisconnect = () => {
            this.connections.clear();
            if (this.syncTimeoutId) {
                clearTimeout(this.syncTimeoutId);
                this.syncTimeoutId = undefined;
            }
        };
        this.onSync = () => {
            if (this.needsConnection()) {
                this.peer.announce();
            }
            this.cleanOldMessages();
            this.syncTimeoutId = undefined;
            this.sync();
        };
        this.sync = () => {
            this.syncTimeoutId = setTimeout(this.onSync, this.syncMS * 0.5 + Math.random() * this.syncMS * 0.5);
        };
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
exports.Mesh = Mesh;
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
