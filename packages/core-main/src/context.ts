let _originId = 'C1';

export function setOriginId(id: string): void {
  _originId = id;
}

export function getOriginId(): string {
  return _originId;
}
