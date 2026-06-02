// TypeScript 5.5+ changed Response.json() to return Promise<unknown>.
// Override to any so fetch-based API calls don't require casts everywhere.
interface Response {
  json(): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
