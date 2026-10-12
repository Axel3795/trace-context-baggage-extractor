# trace-context-baggage-extractor

Parses and normalizes W3C baggage and trace-context headers from a plain headers object into a typed key-value map suitable for downstream propagation.

## Usage

```js
import { extractAll, extractBaggage, extractTraceContext } from 'trace-context-baggage-extractor';

const headers = {
  baggage: 'userId=42,sessionId=abc',
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  tracestate: 'vendor=value'
};

const { baggage, traceparent, tracestate } = extractAll(headers);
// baggage: { userid: '42', sessionid: 'abc' }
// traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
// tracestate: 'vendor=value'
```

## Why this exists

When a request crosses service boundaries, the W3C trace-context and baggage headers carry propagating state. Most server frameworks hand you a headers object but leave parsing to you. This library does that parsing with zero dependencies, normalizing keys to lowercase (baggage keys are case-insensitive per spec) and validating the traceparent format so downstream code gets either a structurally-correct value or `null`.

The trade-off: baggage properties (the `;key=value` suffixes on each entry) are discarded. They are rarely used for propagation in practice, and keeping them would force the return type to be more complex than a flat string map. If you need properties, parse them yourself from the raw header.

## Edge cases

- Baggage keys are lowercased. If your downstream system is case-sensitive, this is the point where you will notice.
- Malformed `traceparent` headers (wrong length, non-hex characters) yield `null`, not an error. This is deliberate: a broken traceparent should not crash the request handler.
- Duplicate baggage keys use last-writer-wins semantics, matching common propagation behavior.
- Header lookup is case-insensitive, so `Baggage`, `baggage`, and `BAGGAGE` all resolve.

## API

- `extractBaggage(headers)` → `Record<string, string>` — parsed baggage map, empty object if absent.
- `extractTraceContext(headers)` → `{ traceparent: string | null, tracestate: string | null }`
- `extractAll(headers)` → `{ baggage: Record<string, string>, traceparent: string | null, tracestate: string | null }`
