/**
 * Minimal canonical-WAV (PCM, 44-byte header) concatenation. Sarvam returns
 * one WAV file per request, and long articles must be split into multiple
 * TTS requests (provider char limits), so their audio needs to be stitched
 * back into a single playable file. Assumes all chunks share the same
 * format (true here since they all come from one provider call with fixed
 * sample rate/channels) — we only need to re-point the RIFF/data sizes.
 */
export function concatWavBuffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error("concatWavBuffers: no buffers to concatenate");
  }
  if (buffers.length === 1) {
    return buffers[0];
  }

  const HEADER_SIZE = 44;
  const header = buffers[0].subarray(0, HEADER_SIZE);
  const dataChunks = buffers.map((buf) => buf.subarray(HEADER_SIZE));
  const totalDataSize = dataChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  const newHeader = Buffer.from(header);
  // RIFF chunk size = total file size - 8 bytes (the "RIFF" + size fields themselves)
  newHeader.writeUInt32LE(36 + totalDataSize, 4);
  // "data" subchunk size
  newHeader.writeUInt32LE(totalDataSize, 40);

  return Buffer.concat([newHeader, ...dataChunks]);
}
