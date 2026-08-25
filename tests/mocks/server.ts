import { setupServer } from "msw/node";

// MSW server singleton for tests. Handlers are added per-test via server.use().
export const server = setupServer();
