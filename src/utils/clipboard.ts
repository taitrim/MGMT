import { writeText } from '@tauri-apps/plugin-clipboard-manager'

let wipeTimeout: number | null = null

export async function copyToClipboardSecure(text: string, wipeAfterMs: number = 30000) {
  try {
    await writeText(text)
    
    if (wipeTimeout) {
      clearTimeout(wipeTimeout)
    }

    wipeTimeout = window.setTimeout(async () => {
      try {
        // Only wipe if the current clipboard content is still what we copied
        // Unfortunately, plugin-clipboard-manager doesn't have a readText yet in v2?
        // Actually it does. Let's check.
        // Wait, for security, we just wipe it anyway.
        await writeText('')
        console.log('Clipboard wiped for security')
      } catch (err) {
        console.error('Failed to wipe clipboard:', err)
      }
      wipeTimeout = null
    }, wipeAfterMs)

    return true
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    return false
  }
}
