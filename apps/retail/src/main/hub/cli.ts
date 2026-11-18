// Punto de entrada del hub de Retail: `pnpm hub [iniciar|codigo|terminales|revocar <id>|huella]`.
// Lo lanza `scripts/hub.cjs` con `ELECTRON_RUN_AS_NODE=1`; el servicio del sistema operativo (F2 PR6)
// ejecuta `iniciar`. La carpeta de datos se puede pisar con GESTION_HUB_DIR.
import { ejecutarComandoHub } from '@core/hub';
import { opcionesHub } from './opciones';

ejecutarComandoHub(process.argv.slice(2), opcionesHub()).catch((e: unknown) => {
  console.error(`[hub] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
