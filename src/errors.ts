/** `code` is the stable identifier; `message` is free text. */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidArgumentError extends DomainError {
  constructor(message: string) {
    super('invalid-argument', message);
  }
}
