/**
 * Core parsing and normalization logic for trace-context and baggage headers.
 *
 * The W3C Baggage specification (https://www.w3.org/TR/baggage/) defines the
 * header format. We implement a pragmatic subset: we split on commas, then on
 * the first `=`, then on the first `;` for properties. Properties are kept
 * but only the `value` is returned in the simple map. This avoids pulling in
 * a full parser while handling the cases that matter for propagation.
 *
 * Key normalization: keys are lowercased and trimmed, per the spec which says
 * keys are case-insensitive. Values are trimmed of surrounding whitespace.
 */

/**
 * Normalizes a single baggage key-value pair string.
 *
 * @param {string} pair - e.g. "userId=42;properties=stuff"
 * @returns {[string, string] | null} tuple of [key, value] or null if invalid
 */
function parseBaggagePair(pair) {
  // Per spec, properties are separated by ';'. We only care about the value
  // itself for the simple map, so we discard properties.
  const valuePart = pair.split(';')[0];
  const eqIndex = valuePart.indexOf('=');
  if (eqIndex === -1) return null;
  const key = valuePart.slice(0, eqIndex).trim().toLowerCase();
  const value = valuePart.slice(eqIndex + 1).trim();
  if (!key) return null;
  return [key, value];
}

/**
 * Extracts baggage from a request-like object.
 *
 * @param {Record<string, string>} headers - A map of header name to value.
 * @returns {Record<string, string>} Normalized key-value map. Empty if no baggage.
 */
export function extractBaggage(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  // Find the baggage header case-insensitively.
  const baggageHeader = findHeader(headers, 'baggage');
  if (!baggageHeader) return out;
  // Baggage is a comma-separated list of key=value pairs.
  const pairs = baggageHeader.split(',');
  for (const pair of pairs) {
    const parsed = parseBaggagePair(pair);
    if (parsed) {
      // Last-writer-wins, per common propagation semantics.
      out[parsed[0]] = parsed[1];
    }
  }
  return out;
}

/**
 * Extracts W3C trace-context (traceparent, tracestate) from a request-like object.
 *
 * @param {Record<string, string>} headers
 * @returns {{ traceparent: string | null, tracestate: string | null }}
 */
export function extractTraceContext(headers) {
  const result = { traceparent: null, tracestate: null };
  if (!headers || typeof headers !== 'object') return result;
  const tp = findHeader(headers, 'traceparent');
  if (tp) {
    // W3C Trace Context spec: version-traceid-spanid-flags (32-8-16-2 hex chars)
    // We validate the format so downstream code can rely on it.
    if (/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(tp.trim())) {
      result.traceparent = tp.trim().toLowerCase();
    }
  }
  const ts = findHeader(headers, 'tracestate');
  if (ts) {
    // tracestate is opaque, we just pass it through trimmed.
    result.tracestate = ts.trim();
  }
  return result;
}

/**
 * Extracts both baggage and trace-context, returning a combined object.
 *
 * @param {Record<string, string>} headers
 * @returns {{ baggage: Record<string, string>, traceparent: string | null, tracestate: string | null }}
 */
export function extractAll(headers) {
  const baggage = extractBaggage(headers);
  const trace = extractTraceContext(headers);
  return {
    baggage,
    traceparent: trace.traceparent,
    tracestate: trace.tracestate,
  };
}

/**
 * Finds a header value case-insensitively.
 *
 * @param {Record<string, string>} headers
 * @param {string} name
 * @returns {string | undefined}
 */
function findHeader(headers, name) {
  const lower = name.toLowerCase();
  // Direct match first (fast path).
  if (headers[name] !== undefined) return headers[name];
  if (headers[lower] !== undefined) return headers[lower];
  // Linear scan for case-insensitive match.
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return undefined;
}
