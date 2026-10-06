// Build-time loaders (see scripts/build.mjs).
declare module '*.svg' {
  /** Path `d` strings extracted from a 256x256 Phosphor icon. */
  const paths: string[];
  export default paths;
}
declare module '*.css' {
  const css: string;
  export default css;
}
