// STOMP wrapper with typed subscribe helpers for every topic in docs/contract.md section 11.
// Clients only subscribe; they never send. With NEXT_PUBLIC_USE_MOCKS=true events come from src/mocks.
import { Client, type StompSubscription } from "@stomp/stompjs";
import { mockRealtime } from "@/mocks/ws";
import { getToken } from "./session";
import type { ChatMessage, DriverOfferEvent, RideLocationEvent, RideStatusEvent } from "./types";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type Unsubscribe = () => void;
export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

export interface RealtimeClient {
  subscribeDriverOffers(driverId: string, onEvent: (e: DriverOfferEvent) => void): Unsubscribe;
  subscribeRideStatus(rideId: string, onEvent: (e: RideStatusEvent) => void): Unsubscribe;
  subscribeRideLocation(rideId: string, onEvent: (e: RideLocationEvent) => void): Unsubscribe;
  subscribeRideChat(rideId: string, onEvent: (e: ChatMessage) => void): Unsubscribe;
  onConnectionChange(listener: (state: ConnectionState) => void): Unsubscribe;
  /** Drop the connection (e.g. on logout). The next subscribe reconnects with the current token. */
  disconnect(): void;
}

export const topics = {
  driverOffers: (driverId: string) => `/topic/drivers/${driverId}/offers`,
  rideStatus: (rideId: string) => `/topic/rides/${rideId}/status`,
  rideLocation: (rideId: string) => `/topic/rides/${rideId}/location`,
  rideChat: (rideId: string) => `/topic/rides/${rideId}/chat`,
};

interface Sub {
  destination: string;
  handler: (body: unknown) => void;
  stomp?: StompSubscription;
}

class StompRealtime implements RealtimeClient {
  private client: Client | null = null;
  private subs = new Set<Sub>();
  private listeners = new Set<(s: ConnectionState) => void>();
  private state: ConnectionState = "idle";

  subscribeDriverOffers(driverId: string, onEvent: (e: DriverOfferEvent) => void) {
    return this.subscribe(topics.driverOffers(driverId), onEvent);
  }
  subscribeRideStatus(rideId: string, onEvent: (e: RideStatusEvent) => void) {
    return this.subscribe(topics.rideStatus(rideId), onEvent);
  }
  subscribeRideLocation(rideId: string, onEvent: (e: RideLocationEvent) => void) {
    return this.subscribe(topics.rideLocation(rideId), onEvent);
  }
  subscribeRideChat(rideId: string, onEvent: (e: ChatMessage) => void) {
    return this.subscribe(topics.rideChat(rideId), onEvent);
  }

  onConnectionChange(listener: (state: ConnectionState) => void): Unsubscribe {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  disconnect() {
    const c = this.client;
    this.client = null;
    this.subs.forEach((s) => (s.stomp = undefined));
    void c?.deactivate();
    this.setState("idle");
  }

  private subscribe<T>(destination: string, onEvent: (e: T) => void): Unsubscribe {
    const sub: Sub = { destination, handler: (b) => onEvent(b as T) };
    this.subs.add(sub);
    const client = this.ensureClient();
    if (client.connected) this.attach(client, sub);
    return () => {
      this.subs.delete(sub);
      sub.stomp?.unsubscribe();
      sub.stomp = undefined;
    };
  }

  private ensureClient(): Client {
    if (this.client) return this.client;
    const token = getToken();
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.setState("connected");
        this.subs.forEach((s) => this.attach(client, s));
      },
      onWebSocketClose: () => {
        this.subs.forEach((s) => (s.stomp = undefined));
        if (this.client === client) this.setState("disconnected");
      },
      onStompError: (frame) => console.error("[ws] STOMP error", frame.headers.message),
    });
    this.client = client;
    this.setState("connecting");
    client.activate();
    return client;
  }

  private attach(client: Client, sub: Sub) {
    sub.stomp = client.subscribe(sub.destination, (msg) => {
      try {
        sub.handler(JSON.parse(msg.body));
      } catch (e) {
        console.error("[ws] bad payload on", sub.destination, e);
      }
    });
  }

  private setState(s: ConnectionState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }
}

export const realtime: RealtimeClient = USE_MOCKS ? mockRealtime : new StompRealtime();
