import { EventEmitter } from "eventemitter3";
import type { Peer } from "./Peer";
export declare const DEFAULT_SYNC_MS = 30000;
export declare const DEFAULT_MESSAGE_LAST_SEEN_DELETE_MS = 60000;
export declare const DEFAULT_REPLACE_OLD_PEER_MS = 60000;
export interface IMeshEvents {
    data(data: any, from: string): void;
}
export interface IMeshOptions {
    maxConnections?: number;
    syncMS?: number;
    messageLastSeenDeleteMS?: number;
    replaceOldPeerMS?: number;
}
export declare class Mesh extends EventEmitter<IMeshEvents> {
    protected peer: Peer;
    protected maxConnections: number;
    protected syncMS: number;
    protected messageLastSeenDeleteMS: number;
    protected replaceOldPeerMS: number;
    protected messageId: number;
    protected messages: Map<string, number>;
    protected connections: Map<string, number>;
    protected payloadsToSend: Array<any>;
    protected syncTimeoutId: unknown | undefined;
    constructor(peer: Peer, options?: IMeshOptions);
    getPeer(): Peer;
    broadcast(payload: any): this | undefined;
    private broadcastInternal;
    private needsConnection;
    private onData;
    private onDiscover;
    private onConnection;
    private onDisconnection;
    private onDisconnect;
    private onSync;
    private sync;
    private cleanOldMessages;
}
