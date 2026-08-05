import { describe, expect, it } from 'vitest'

import { isAnimatedWebP } from '../lib/assets'

/**
 * A crafted WebP header: 'RIFF' <size> 'WEBP' 'VP8X' <size> <flags…>. Only the
 * bytes `isAnimatedWebP` reads matter; the animation flag is bit 0x02 of the
 * flags byte at offset 20.
 */
const webpHeader = (fourthChunk: string, flags: number): ArrayBuffer => {
  const bytes = new Uint8Array(24)
  const write = (offset: number, tag: string) => {
    for (let i = 0; i < tag.length; i++) bytes[offset + i] = tag.charCodeAt(i)
  }

  write(0, 'RIFF')
  write(8, 'WEBP')
  write(12, fourthChunk)
  bytes[20] = flags

  return bytes.buffer
}

describe('isAnimatedWebP', () => {
  it('detects an animated WebP by the VP8X animation flag', () => {
    expect(isAnimatedWebP(webpHeader('VP8X', 0x02))).toBe(true)
    // animation set alongside alpha (0x10)
    expect(isAnimatedWebP(webpHeader('VP8X', 0x12))).toBe(true)
  })

  it('rejects a VP8X WebP with the flag clear', () => {
    expect(isAnimatedWebP(webpHeader('VP8X', 0x00))).toBe(false)
    expect(isAnimatedWebP(webpHeader('VP8X', 0x10))).toBe(false)
  })

  it('rejects a still WebP that has no extended header', () => {
    expect(isAnimatedWebP(webpHeader('VP8 ', 0x02))).toBe(false)
    expect(isAnimatedWebP(webpHeader('VP8L', 0x02))).toBe(false)
  })

  it('rejects a non-WebP file and a truncated one', () => {
    const notWebP = new Uint8Array(24)
    notWebP.set([0x89, 0x50, 0x4e, 0x47]) // PNG magic
    expect(isAnimatedWebP(notWebP.buffer)).toBe(false)

    expect(isAnimatedWebP(new Uint8Array(8).buffer)).toBe(false)
  })
})
