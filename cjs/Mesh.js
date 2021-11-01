"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mesh = exports.DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = exports.DEFAULT_SYNC_MS = void 0;
const eventemitter3_1 = require("eventemitter3");
const buffer_1 = require("buffer");
const rand_1 = require("@aicacia/rand");
exports.DEFAULT_SYNC_MS = 60000;
exports.DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 3 * 60000;
class Mesh extends eventemitter3_1.EventEmitter {
    constructor(peer, options = {}) {
        super();
        this.maxConnections = 6;
        this.syncMS = exports.DEFAULT_SYNC_MS;
        this.messageLastSeenDeleteMS = exports.DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS;
        this.messageId = 0;
        this.messages = new Map();
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
        this.onSync = () => {
            if (this.needsConnection()) {
                this.peer.announce();
            }
            this.cleanOldMessages();
            this.sync();
        };
        this.peer = peer;
        this.peer.on("data", this.onData);
        this.peer.on("join", this.onDiscover);
        this.peer.on("announce", this.onDiscover);
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
    sync() {
        setTimeout(this.onSync, (0, rand_1.nextIntInRange)(this.syncMS * 0.5, this.syncMS));
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
function getRandomIdExceptFor(ids, id) {
    const randomId = (0, rand_1.fromArray)(ids).unwrap();
    if (randomId === id) {
        return getRandomIdExceptFor(ids, id);
    }
    else {
        return randomId;
    }
}
