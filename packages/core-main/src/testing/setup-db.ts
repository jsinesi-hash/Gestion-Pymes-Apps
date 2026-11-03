// setupFiles del runner de Electron: deja listo el esquema del núcleo antes de cada archivo de test.
import { prepararEsquemaCore } from './esquema';

await prepararEsquemaCore();
