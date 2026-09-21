import { useParams } from 'react-router-dom';

// Types declared here; helpers added with each view in P1.x
export type ProductoParams = { id: string };

export function useProductoParams() {
  return useParams() as ProductoParams;
}
