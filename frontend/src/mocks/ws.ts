// Mock RealtimeClient: delivers the events published by src/mocks/api.ts through the in-memory bus.
import type { ConnectionState, RealtimeClient, Unsubscribe } from "@/lib/ws";
import type { ChatMessage, DriverOfferEvent, RideLocationEvent, RideStatusEvent } from "@/lib/types";
import { subscribe } from "./bus";

function sub<T>(topic: string, onEvent: (e: T) => void): Unsubscribe {
  return subscribe(topic, (payload) => onEvent(payload as T));
}

export const mockRealtime: RealtimeClient = {
  subscribeDriverOffers: (driverId, onEvent: (e: DriverOfferEvent) => void) => sub(`/topic/drivers/${driverId}/offers`, onEvent),
  subscribeRideStatus: (rideId, onEvent: (e: RideStatusEvent) => void) => sub(`/topic/rides/${rideId}/status`, onEvent),
  subscribeRideLocation: (rideId, onEvent: (e: RideLocationEvent) => void) => sub(`/topic/rides/${rideId}/location`, onEvent),
  subscribeRideChat: (rideId, onEvent: (e: ChatMessage) => void) => sub(`/topic/rides/${rideId}/chat`, onEvent),
  onConnectionChange(listener: (state: ConnectionState) => void) {
    listener("connected");
    return () => {};
  },
  disconnect() {},
};
