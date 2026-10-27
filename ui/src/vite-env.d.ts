/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API base; defaults to the relative "/api". */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
