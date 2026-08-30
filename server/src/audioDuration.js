// Measuring how long a track is, without downloading it.
//
// Dropbox reports a file's size but never its duration, and this backend
// deliberately never proxies audio — so at sync time a track's length is simply
// unknown, the row lands with duration_seconds = 0, and the studio and players
// render "0:00". Until now the only cure was a listener playing the track so
// the browser's <audio> element could report what it found.
//
// A Dropbox temporary link is Range-capable, and that is enough to do better.
// Every container this app accepts keeps the numbers that yield a duration in a
// header, a trailer, or the frame stream itself, and music-metadata will find
// them given random access. So a link is wrapped in the smallest possible
// Blob-alike that fetches byte ranges on demand: MP3, FLAC, WAV, AIFF, M4A and
// WMA give up a duration inside ~100KB of a multi-megabyte file. Ogg, Opus and
// raw AAC have to be scanned frame by frame, which is why MAX_PROBE_BYTES
// exists — a pathologically large one is abandoned rather than streamed whole.
import { parseBlob } from 'music-metadata';
import { getStreamUrl } from './streamLinks.js';

/** Range request granularity. Large enough that a typical probe is 2 requests. */
const BLOCK_BYTES = 64 * 1024;
/** Blocks held per probe. Parsers read forward, so an evicted block is rarely re-read. */
const MAX_CACHED_BLOCKS = 48;
/** Give up rather than pull an unbounded file through the backend. */
const MAX_PROBE_BYTES = 32 * 1024 * 1024;
/** Matches the ceiling the client-reported endpoint enforces. */
const MAX_DURATION_SECONDS = 86_400;

/** A temporary link dies when the file is replaced; these are worth one retry. */
const STALE_LINK_STATUS = new Set([401, 403, 404, 410]);

class ProbeBudgetError extends Error {}

/**
 * One remote file, addressed in fixed-size blocks.
 *
 * Blocks are cached as promises so two overlapping slices of the same region
 * share a single request rather than racing.
 */
class RemoteFile {
  constructor(url, size) {
    this.url = url;
    this.size = size;
    this.blocks = new Map();
    this.bytesFetched = 0;
  }

  seed(index, bytes) {
    this.blocks.set(index, Promise.resolve(bytes));
    this.bytesFetched += bytes.length;
  }

  block(index) {
    const cached = this.blocks.get(index);
    if (cached) return cached;

    const from = index * BLOCK_BYTES;
    if (from >= this.size) return Promise.resolve(new Uint8Array(0));
    const to = Math.min(from + BLOCK_BYTES, this.size) - 1;

    if (this.bytesFetched + (to - from + 1) > MAX_PROBE_BYTES) {
      return Promise.reject(new ProbeBudgetError(`exceeded ${MAX_PROBE_BYTES} probe bytes`));
    }
    this.bytesFetched += to - from + 1;

    const pending = fetch(this.url, { headers: { Range: `bytes=${from}-${to}` } })
      .then(async (res) => {
        if (!res.ok) throw httpError(res.status, this.url);
        const body = new Uint8Array(await res.arrayBuffer());
        // A 200 means the origin ignored Range and sent everything; the window
        // this block stands for is still just its slice of that body.
        return res.status === 206 ? body : body.subarray(from, to + 1);
      });

    this.blocks.set(index, pending);
    // Insertion order is fetch order, so the oldest key is the furthest behind
    // the parser's read head.
    while (this.blocks.size > MAX_CACHED_BLOCKS) {
      const oldest = this.blocks.keys().next().value;
      if (oldest === index) break;
      this.blocks.delete(oldest);
    }
    return pending;
  }
}

/**
 * The Blob surface strtok3's BlobTokenizer actually uses: `size`, `type`, and
 * `slice(...).arrayBuffer()`. Nothing here touches the network until the parser
 * asks for a specific window.
 */
class RemoteBlob {
  constructor(file, start, end) {
    this.file = file;
    this.start = start;
    this.end = end;
  }

  get size() {
    return this.end - this.start;
  }

  /**
   * Left empty on purpose. music-metadata falls back to sniffing the container
   * from its magic bytes, which is right more often than an extension is — a
   * `.m4a` holding an MP3 stream still gets measured correctly.
   */
  get type() {
    return '';
  }

  slice(from, to) {
    return new RemoteBlob(this.file, this.start + from, this.start + to);
  }

  async arrayBuffer() {
    const out = new Uint8Array(Math.max(0, this.end - this.start));
    const first = Math.floor(this.start / BLOCK_BYTES);
    const last = Math.floor(Math.max(this.start, this.end - 1) / BLOCK_BYTES);

    for (let index = first; index <= last; index++) {
      const block = await this.file.block(index);
      const blockStart = index * BLOCK_BYTES;
      const from = Math.max(this.start, blockStart);
      const to = Math.min(this.end, blockStart + block.length);
      if (to > from) out.set(block.subarray(from - blockStart, to - blockStart), from - this.start);
    }
    return out.buffer;
  }
}

function httpError(status, url) {
  const err = new Error(`HTTP ${status} reading ${url.split('?')[0]}`);
  err.status = status;
  return err;
}

/**
 * Open `url` for random access, spending one request to learn its size.
 *
 * That first request doubles as the read of the opening block, which is where
 * most formats keep what we're after — so the common case costs no extra
 * round-trip. An origin that ignores Range hands back the whole body, and there
 * is then nothing left to fetch.
 */
async function openRemote(url) {
  const res = await fetch(url, { headers: { Range: `bytes=0-${BLOCK_BYTES - 1}` } });
  if (!res.ok) throw httpError(res.status, url);
  const head = new Uint8Array(await res.arrayBuffer());

  if (res.status !== 206) return new Blob([head]);

  const total = Number(/\/(\d+)\s*$/.exec(res.headers.get('content-range') || '')?.[1]);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('range response carried no usable Content-Range');
  }

  const file = new RemoteFile(url, total);
  file.seed(0, head);
  return new RemoteBlob(file, 0, total);
}

async function measure(url) {
  const { format } = await parseBlob(await openRemote(url), { duration: true });
  const seconds = Math.round(Number(format.duration));
  // A parse can succeed and still yield nothing usable (a stream with no length
  // in it, or Infinity from a live-style container). That is a failed probe.
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DURATION_SECONDS) return null;
  return seconds;
}

/**
 * How many seconds long the track at `filePath` is, or null if it can't be read.
 *
 * Cached temporary links are reused, so a probe run right after a sync mostly
 * costs range requests rather than Dropbox API calls. A link that has died
 * because the file was replaced is worth exactly one retry with a fresh one.
 */
export async function probeDuration(filePath) {
  const url = await getStreamUrl(filePath);
  try {
    return await measure(url);
  } catch (err) {
    if (err instanceof ProbeBudgetError) {
      console.warn(`[duration] ${filePath}: ${err.message}`);
      return null;
    }
    if (!STALE_LINK_STATUS.has(err.status)) throw err;
    return measure(await getStreamUrl(filePath, { fresh: true }));
  }
}
