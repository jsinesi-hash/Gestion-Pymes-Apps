// Constantes inyectadas por @electron-forge/plugin-vite en tiempo de build
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_PRELOAD_VITE_ENTRY: string;

// electron-squirrel-startup no publica tipos propios
declare module 'electron-squirrel-startup' {
  const started: boolean;
  export default started;
}
