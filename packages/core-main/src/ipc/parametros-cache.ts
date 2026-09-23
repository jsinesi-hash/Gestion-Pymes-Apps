const _cache = new Map<string, string | null>();

export function getCachedParametro(clave: string): { loaded: boolean; value: string | null } {
  if (_cache.has(clave)) return { loaded: true, value: _cache.get(clave)! };
  return { loaded: false, value: null };
}

export function setCachedParametro(clave: string, value: string | null): void {
  _cache.set(clave, value);
}

export function invalidateCachedParametro(clave?: string): void {
  if (clave === undefined) {
    _cache.clear();
  } else {
    _cache.delete(clave);
  }
}
