// Used only to produce the Basic-tier "compressed" sibling of an uploaded
// photo -- Super/Premium always get the original file untouched (see
// uploadImage in Details.tsx). Quality/dimension are chosen to still look
// good on a phone screen, just meaningfully smaller than a full-res original.
const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.75

export function compressImageToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read image'))
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not create blob'))),
          'image/jpeg',
          JPEG_QUALITY,
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
