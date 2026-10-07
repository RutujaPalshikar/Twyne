export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const roomClosed = () =>
  new HttpError(404, "This room does not exist or has been closed.", "ROOM_CLOSED");
