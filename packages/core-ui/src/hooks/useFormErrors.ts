import { useCallback, useState } from 'react';

export type Validadores<K extends string> = Record<K, (valor: string) => string>;

export function useFormErrors<K extends string>(validadores: Validadores<K>, orden?: readonly K[]) {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const onBlur = useCallback((campo: K, valor: string) => {
    setErrors(prev => ({ ...prev, [campo]: validadores[campo](valor) }));
  }, [validadores]);
  const setErrorBackend = useCallback((campo: K, mensaje: string) => {
    setErrors(prev => ({ ...prev, [campo]: mensaje }));
  }, []);
  // Valida todos; setea errores; devuelve el primer campo inválido (en `orden` si se dio,
  // o en el orden de las claves) o undefined si está todo ok. Enfoca ese campo si idDe existe.
  const validarTodo = useCallback((valores: Record<K, string>, idDe?: (c: K) => string): K | undefined => {
    const claves = (orden ?? (Object.keys(validadores) as K[]));
    const errs: Partial<Record<K, string>> = {};
    let primero: K | undefined;
    for (const c of claves) {
      const msg = validadores[c](valores[c] ?? '');
      if (msg) { errs[c] = msg; if (!primero) primero = c; }
    }
    setErrors(errs);
    if (primero && idDe) document.getElementById(idDe(primero))?.focus();
    return primero;
  }, [validadores, orden]);
  return { errors, onBlur, setErrorBackend, validarTodo };
}
