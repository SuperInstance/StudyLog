/**
 * StudyLoG.AI Agent Coordinator
 *
 * A multi-agent coordination system for managing AI learning agents across
 * the three stages: Cognitive Mill, Intelligence Ranch, and Sitka Sound.
 *
 * @packageDocumentation
 */

// Types
export * from "./types.js";

// Roles
export * from "./roles.js";

// Event Bus
export { EventBus, getGlobalEventBus, resetGlobalEventBus, emitEvent, subscribe, unsubscribe } from "./event-bus.js";

// Task Queue
export { TaskQueue, createTaskQueue } from "./task-queue.js";

// Coordinator
export {
  StudyLogCoordinator,
  createCoordinator,
  startCoordinator,
  type StudyLogCoordinatorOptions,
} from "./coordinator.js";
