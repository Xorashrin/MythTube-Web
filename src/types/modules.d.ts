// Packages that ship without TypeScript declarations.
declare module 'cheerio-without-node-native' {
  const cheerio: {
    load: (html: string, options?: Record<string, unknown>) => unknown;
  };
  export default cheerio;
}
