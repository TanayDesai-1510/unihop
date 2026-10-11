// In-memory pub/sub standing in for the STOMP broker. Topic strings match lib/ws.ts `topics`.
type Handler = (payload: unknown) => void;

const handlers = new Map<string, Set<Handler>>();

export function publish(topic: string, payload: unknown): void {
  // Clone so subscribers can't mutate mock state, like a real JSON round trip.
  const body = JSON.parse(JSON.stringify(payload));
  handlers.get(topic)?.forEach((h) => {
    try {
      h(body);
    } catch (e) {
      console.error("[mock ws] handler error on", topic, e);
    }
  });
}

export function subscribe(topic: string, handler: Handler): () => void {
  if (!handlers.has(topic)) handlers.set(topic, new Set());
  handlers.get(topic)!.add(handler);
  return () => handlers.get(topic)?.delete(handler);
}
