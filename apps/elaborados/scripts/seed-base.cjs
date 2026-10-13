'use strict';
// `pnpm seed:base` — solo datos base (auth, impuestos, Consumidor Final, categorías de venta y
// grupo "Sabores"), sin catálogo demo, clientes ni ventas. Reutiliza seed-dev.cjs con --base.
process.argv.splice(2, 0, '--base');
require('./seed-dev.cjs');
