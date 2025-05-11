/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUB_URL: string;
  // diğer env değişkenleri buraya eklenebilir
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
