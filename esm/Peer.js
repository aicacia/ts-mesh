import { EventEmitter } from "eventemitter3";
import { io } from "socket.io-client";
export class Peer extends EventEmitter {
    socket;
    connections = new Map();
    SimplePeer;
    constructor(SimplePeer, options = {}) {
        super();
        this.SimplePeer = SimplePeer;
        this.socket = io(`${options.origin || "wss://mesh.aicacia.com"}/${options.namespace || ""}`);
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
    getConnections() {
        return this.connections;
    }
    onSignal = (data, from) => {
        let connection = this.connections.get(from);
        if (data.type === "offer" && connection?.initiator) {
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
    onConnect = () => {
        this.emit("connect", this.socket.id);
    };
    onDisonnect = () => {
        this.emit("disconnect");
        for (const [id, connection] of this.connections.entries()) {
            this.emit("disconnection", connection, id);
            connection.destroy();
        }
        this.connections.clear();
    };
    onJoin = (id) => {
        if (id !== this.socket.id) {
            this.emit("join", id);
        }
    };
    onAnnounce = (id) => {
        if (id !== this.socket.id) {
            this.emit("announce", id);
        }
    };
    onLeave = (id, _reason) => {
        this.disconnectFrom(id);
    };
    send(to, data) {
        const connection = this.connections.get(to);
        if (connection?.connected) {
            connection.send(data);
        }
        return this;
    }
    broadcast(data) {
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
    get(id) {
        return this.connections.get(id);
    }
    connectToInBackground(id) {
        this.getOrCreateConnection(id, true);
        return this;
    }
    connectTo(id) {
        const connection = this.getOrCreateConnection(id, true);
        return new Promise((resolve, reject) => {
            if (connection.connected) {
                resolve(connection);
            }
            else {
                const onConnect = () => {
                    removeListeners();
                    resolve(connection);
                };
                const onClose = () => {
                    removeListeners();
                    reject();
                };
                const onError = (error) => {
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
    disconnectFrom(id, emit = true) {
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
    getOrCreateConnection(id, initiator) {
        const connection = this.connections.get(id);
        if (connection) {
            return connection;
        }
        else {
            return this.createConnection(id, initiator);
        }
    }
    createConnection(id, initiator) {
        const connection = new this.SimplePeer({
            initiator,
            trickle: false,
        });
        connection.on("signal", (data) => {
            this.socket.emit("signal", id, data);
        });
        connection.on("data", (data) => {
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
export function waitForSocket(socket) {
    return new Promise((resolve, reject) => {
        if (socket.connected) {
            resolve(socket);
        }
        else {
            const onConnect = () => {
                removeListeners();
                resolve(socket);
            };
            const onClose = () => {
                removeListeners();
                reject();
            };
            const onError = (error) => {
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
