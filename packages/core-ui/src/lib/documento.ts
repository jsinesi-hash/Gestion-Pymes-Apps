type TipoDocumento = 'DNI' | 'CUIT' | 'CUIL';

export function formatDocumento(tipo: TipoDocumento, rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');

  if (tipo === 'CUIT' || tipo === 'CUIL') {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  }

  // DNI
  return digits.slice(0, 8);
}

export function validarDocumento(tipo: TipoDocumento, valor: string): string | null {
  const digits = valor.replace(/\D/g, '');

  if (tipo === 'CUIT' || tipo === 'CUIL') {
    if (digits.length !== 11) return 'Debe tener 11 dígitos (XX-XXXXXXXX-X).';
    return null;
  }

  // DNI
  if (digits.length < 7 || digits.length > 8) return 'El DNI debe tener 7 u 8 dígitos.';
  return null;
}

export function validarTelefono(valor: string): string | null {
  if (!valor.trim()) return null;
  if (!/^[0-9 +\-()\s]*$/.test(valor)) return 'El teléfono solo puede contener números.';
  return null;
}

export function validarCodigoPostal(valor: string): string | null {
  if (!valor.trim()) return null;
  if (valor.length > 8) return 'El código postal no puede superar 8 caracteres.';
  if (!/^[a-zA-Z0-9]+$/.test(valor)) return 'El código postal solo puede contener letras y números.';
  return null;
}
