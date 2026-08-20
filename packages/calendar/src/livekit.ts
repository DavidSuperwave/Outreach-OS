import { CalendarError } from "./errors.js";

/** LiveKit stays external. N13 mints a handle only — no live room, no SDK. */
export const LIVEKIT_LIVE = false;

export interface LiveKitRoomHandle {
  callId: string;
  roomName: string;
  token: string;
  live: false;
  url: null;
}

export function mintRoomHandle(callId: string): LiveKitRoomHandle {
  return {
    callId,
    roomName: `room_${callId}`,
    token: `lk_stub_${callId}`,
    live: false,
    url: null,
  };
}

/**
 * Call-recording PREVIEW is OD-8 / N15. Stub always fails closed.
 */
export const PREVIEW_SUPPORTED = false;

export function preview(): never {
  throw new CalendarError("preview_unsupported", "call recording preview is OD-8/N15; unsupported in N13");
}

export class LiveKitStub {
  mintRoomToken(callId: string): LiveKitRoomHandle {
    return mintRoomHandle(callId);
  }

  join(callId: string): LiveKitRoomHandle {
    return mintRoomHandle(callId);
  }

  preview(): never {
    return preview();
  }
}
