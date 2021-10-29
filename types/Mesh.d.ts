import { EventEmitter } from "eventemitter3";
import type { IPeerData } from "./Peer";
import type { Peer } from "./Peer";
export declare const DEFAULT_SYNC_MS = 60000;
export declare const DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS: number;
export interface IMeshEvents {
    data(data: IPeerData, from: string): void;
}
export interface IMeshOptions {
    maxConnections?: number;
    syncMS?: number;
    messageLastSeenDeleteMS?: number;
}
export declare class Mesh extends EventEmitter<IMeshEvents> {
    protected peer: Peer;
    protected maxConnections: number;
    protected syncMS: number;
    protected messageLastSeenDeleteMS: number;
    protected messageId: number;
    protected messages: Map<string, number>;
    constructor(peer: Peer, options?: IMeshOptions);
    getPeer(): Peer;
    broadcast(payload: IPeerData): this;
    private needsConnection;
    private onData;
    private onDiscover;
    private onSync;
    private sync;
    private cleanOldMessages;
}
