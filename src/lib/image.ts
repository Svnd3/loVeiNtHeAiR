const MAX_DIMENSION = 900
const JPEG_QUALITY = 0.7

function drawToCanvas(file: File): Promise<HTMLCanvasElement> {
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
        resolve(canvas)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export async function compressImage(file: File): Promise<string> {
  const canvas = await drawToCanvas(file)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export async function compressImageToBlob(file: File): Promise<Blob> {
  const canvas = await drawToCanvas(file)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create blob'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
