import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const publicDir = resolve(process.cwd(), 'public')

test('standalone manifest and icons are packaged without offline service worker', () => {
  const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf8')) as {
    name: string
    display: string
    start_url: string
    icons: Array<{ src: string; sizes: string; purpose: string }>
  }
  expect(manifest.name).toBe('MapMory')
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/')
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) {
    const bytes = readFileSync(resolve(publicDir, icon.src.replace(/^\//, '')))
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
    const [width, height] = icon.sizes.split('x').map(Number)
    expect(bytes.readUInt32BE(16)).toBe(width)
    expect(bytes.readUInt32BE(20)).toBe(height)
  }
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
  expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"')
})
