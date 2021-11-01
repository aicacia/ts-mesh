import { EventEmitter } from "eventemitter3";
import type { SimplePeerData, Instance } from "simple-peer";
import type SimplePeer from "simple-peer";
import { Socket } from "socket.io-client";
export declare type IPeerData = SimplePeerData;
export declare type PeerConnection = Instance;
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
    origin?: string;
    namespace?: string;
}
export declare class Peer extends EventEmitter<IPeerEvents> {
    protected socket: Socket;
    protected readonly connections: Map<string, PeerConnection>;
    protected SimplePeer: SimplePeer.SimplePeer;
    constructor(SimplePeer: SimplePeer.SimplePeer, options?: IPeerOptions);
    getId(): string;
    isConnected(): boolean;
    connected(): Promise<Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>>;
    getConnections(): ReadonlyMap<string, PeerConnection>;
    private onSignal;
    private onConnect;
    private onDisonnect;
    private onJoin;
    private onAnnounce;
    private onLeave;
    send(to: string, data: IPeerData): this;
    broadcast(data: IPeerData): this;
    announce(): this;
    get(id: string): Instance | undefined;
    connectToInBackground(id: string): this;
    connectTo(id: string): Promise<Instance>;
    disconnectFrom(id: string, emit?: boolean): this;
    private getOrCreateConnection;
    private createConnection;
}
export declare function waitForSocket(socket: Socket): Promise<Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap>>;
