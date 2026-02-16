type EventHandler = (event: ForumEvent) => void;

export type ForumEvent = {
  type: "post:created" | "post:updated" | "comment:created" | "vote:changed";
  data: Record<string, unknown>;
  timestamp: string;
};

class ForumEventEmitter {
  private handlers = new Set<EventHandler>();

  subscribe(handler: EventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: Omit<ForumEvent, "timestamp">) {
    const fullEvent = { ...event, timestamp: new Date().toISOString() };
    for (const handler of this.handlers) {
      handler(fullEvent);
    }
  }
}

export const forumEvents = new ForumEventEmitter();
