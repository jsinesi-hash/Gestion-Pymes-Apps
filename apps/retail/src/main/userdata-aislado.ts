import { app } from 'electron';
import { aplicarUserDataAislado } from '@core/main';

// Efecto de importación: debe evaluarse ANTES de './db/client' (que abre la BD al importarse). Si
// GESTION_USER_DATA_DIR está puesta, todos los datos de la app van a esa carpeta y no a la del usuario.
aplicarUserDataAislado(app, process.env);
