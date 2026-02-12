import type CourtroomWebSocketClient from "./src/api/courtroom-websocket-client";

declare global {
  // eslint-disable-next-line no-var
  var masterCourt: CourtroomWebSocketClient;
}

export {};
