declare module 'csv-parser' {
  import { Transform } from 'stream';
  interface CsvParserOptions {
    separator?: string;
    headers?: string[] | boolean;
    mapHeaders?: (args: { header: string; index: number }) => string;
    mapValues?: (args: { header: string; index: number; value: any }) => any;
    skipComments?: boolean | string;
    strict?: boolean;
  }
  function csv(options?: CsvParserOptions): Transform;
  export default csv;
}
