import lamejs from '@breezystack/lamejs'

const KBPS = 128
const SAMPLES_PER_FRAME = 1152

function floatTo16(samples) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export async function blobToMp3(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx         = new (window.OfflineAudioContext || window.webkitOfflineAudioContext || window.AudioContext || window.webkitAudioContext)(1, 44100, 44100)
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))

  const sampleRate = audioBuffer.sampleRate
  const numCh      = Math.min(audioBuffer.numberOfChannels, 2)
  const encoder    = new lamejs.Mp3Encoder(numCh, sampleRate, KBPS)

  const left  = floatTo16(audioBuffer.getChannelData(0))
  const right = numCh === 2 ? floatTo16(audioBuffer.getChannelData(1)) : null

  const chunks = []
  for (let i = 0; i < left.length; i += SAMPLES_PER_FRAME) {
    const l = left.subarray(i, i + SAMPLES_PER_FRAME)
    const r = right ? right.subarray(i, i + SAMPLES_PER_FRAME) : null
    const buf = right ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l)
    if (buf.length) chunks.push(buf)
  }
  const tail = encoder.flush()
  if (tail.length) chunks.push(tail)

  return new Blob(chunks, { type: 'audio/mpeg' })
}
