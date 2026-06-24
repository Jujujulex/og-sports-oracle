/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORACLE_CONTRACT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
