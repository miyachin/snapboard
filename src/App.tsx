import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_IMAGES = 3

const ASPECT_RATIOS = [
  { label: '16:9', width: 1920, height: 1080 },
  { label: '4:3', width: 1600, height: 1200 },
  { label: '1:1', width: 1440, height: 1440 },
  { label: '3:4', width: 1200, height: 1600 },
  { label: '9:16', width: 1080, height: 1920 },
] as const

interface ImageItem {
  file: File
  url: string
  img: HTMLImageElement
  caption: string
}

function App() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [aspectIndex, setAspectIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImage = (file: File): Promise<ImageItem> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => resolve({ file, url, img, caption: '' })
      img.onerror = reject
      img.src = url
    })
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const remaining = MAX_IMAGES - images.length
    const toAdd = imageFiles.slice(0, remaining)
    if (toAdd.length === 0) return

    const loaded = await Promise.all(toAdd.map(loadImage))
    setImages(prev => {
      const next = [...prev, ...loaded].slice(0, MAX_IMAGES)
      return next
    })
  }, [images.length])

  const updateCaption = (index: number, caption: string) => {
    setImages(prev => prev.map((item, i) => i === index ? { ...item, caption } : item))
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].url)
      next.splice(index, 1)
      return next
    })
  }

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || images.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = ASPECT_RATIOS[aspectIndex]
    const CANVAS_WIDTH = ratio.width
    const CANVAS_HEIGHT = ratio.height
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    // Clean white background
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const count = images.length
    const padding = 80
    const gap = 60
    const hasAnyCaption = images.some(item => item.caption)
    const captionHeight = hasAnyCaption ? 100 : 0
    const totalGap = gap * (count - 1)
    const availableWidth = CANVAS_WIDTH - padding * 2 - totalGap
    const slotWidth = availableWidth / count
    const slotHeight = CANVAS_HEIGHT - padding * 2 - captionHeight

    // Phone mockup constants
    const bezel = 12
    const cornerRadius = 52
    const homeBarWidth = 80
    const homeBarHeight = 4

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    images.forEach((item, i) => {
      const { img, caption } = item

      // Calculate phone frame size based on screenshot aspect ratio
      const imgAspect = img.naturalWidth / img.naturalHeight
      const screenSlotWidth = slotWidth - bezel * 2
      const screenSlotHeight = slotHeight - bezel * 2

      let screenW: number, screenH: number
      if (imgAspect > screenSlotWidth / screenSlotHeight) {
        screenW = screenSlotWidth
        screenH = screenSlotWidth / imgAspect
      } else {
        screenH = screenSlotHeight
        screenW = screenSlotHeight * imgAspect
      }

      const phoneW = screenW + bezel * 2
      const phoneH = screenH + bezel * 2
      const slotX = padding + i * (slotWidth + gap)
      const phoneX = slotX + (slotWidth - phoneW) / 2
      const phoneY = padding + (slotHeight - phoneH) / 2

      // Shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 10
      roundRect(phoneX, phoneY, phoneW, phoneH, cornerRadius)
      ctx.fillStyle = '#1a1a1a'
      ctx.fill()
      ctx.restore()

      // Phone body
      roundRect(phoneX, phoneY, phoneW, phoneH, cornerRadius)
      ctx.fillStyle = '#1a1a1a'
      ctx.fill()

      // Screen area (clipped with rounded corners)
      const screenX = phoneX + bezel
      const screenY = phoneY + bezel
      const innerRadius = cornerRadius - bezel
      ctx.save()
      roundRect(screenX, screenY, screenW, screenH, innerRadius)
      ctx.clip()
      ctx.drawImage(img, screenX, screenY, screenW, screenH)
      ctx.restore()

      // Dynamic Island
      const islandWidth = screenW * 0.28
      const islandHeight = 20
      const islandX = phoneX + phoneW / 2 - islandWidth / 2
      const islandY = screenY + 14
      ctx.beginPath()
      ctx.roundRect(islandX, islandY, islandWidth, islandHeight, islandHeight / 2)
      ctx.fillStyle = '#000000'
      ctx.fill()

      // Home bar indicator
      const barX = phoneX + phoneW / 2 - homeBarWidth / 2
      const barY = phoneY + phoneH - bezel - 10
      ctx.beginPath()
      ctx.roundRect(barX, barY, homeBarWidth, homeBarHeight, 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fill()

      // Caption with word wrap
      if (caption) {
        ctx.fillStyle = '#4b5563'
        ctx.font = '600 36px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        const maxWidth = slotWidth - 20
        const lineHeight = 44
        const lines: string[] = []
        let currentLine = ''

        for (const char of caption) {
          const testLine = currentLine + char
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = char
          } else {
            currentLine = testLine
          }
        }
        if (currentLine) lines.push(currentLine)

        const startY = padding + slotHeight + 20
        lines.forEach((line, li) => {
          ctx.fillText(line, slotX + slotWidth / 2, startY + li * lineHeight)
        })
      }
    })
  }, [images, aspectIndex])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `screenshots-${ASPECT_RATIOS[aspectIndex].label.replace(':', 'x')}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-1 tracking-tight">
          Screenshot Combiner
        </h1>
        <p className="text-neutral-500 text-sm text-center mb-10">
          Upload up to 3 screenshots and export as a single image
        </p>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => images.length < MAX_IMAGES && fileInputRef.current?.click()}
          className={`border border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-violet-500 bg-violet-500/10'
              : images.length >= MAX_IMAGES
                ? 'border-neutral-800 bg-neutral-900/50 cursor-not-allowed'
                : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className={`text-4xl mb-3 ${isDragging ? 'text-violet-400' : 'text-neutral-600'}`}>+</div>
          <p className="text-neutral-400 text-sm">
            {images.length >= MAX_IMAGES
              ? 'Maximum number of images reached'
              : 'Drag & drop or click to select images'}
          </p>
          <p className="text-neutral-600 text-xs mt-2">
            {images.length} / {MAX_IMAGES}
          </p>
        </div>

        {/* Thumbnails + Captions */}
        {images.length > 0 && (
          <div className="flex gap-5 mt-8 justify-center">
            {images.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2.5">
                <div className="relative group">
                  <img
                    src={item.url}
                    alt={`Screenshot ${i + 1}`}
                    className="h-36 rounded-xl object-contain bg-neutral-900 ring-1 ring-neutral-800"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-2 -right-2 bg-neutral-700 hover:bg-red-500 text-neutral-300 hover:text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    x
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={`Caption ${i + 1}`}
                  value={item.caption ?? ''}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  className="w-36 text-xs text-center text-neutral-300 placeholder-neutral-600 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {images.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Preview</h2>
              <div className="flex gap-1">
                {ASPECT_RATIOS.map((ratio, i) => (
                  <button
                    key={ratio.label}
                    onClick={() => setAspectIndex(i)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                      aspectIndex === i
                        ? 'bg-violet-600 text-white'
                        : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden ring-1 ring-neutral-800">
              <canvas
                ref={canvasRef}
                width={ASPECT_RATIOS[aspectIndex].width}
                height={ASPECT_RATIOS[aspectIndex].height}
                className="w-full"
              />
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={handleDownload}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 px-8 rounded-xl transition-colors text-sm"
              >
                Download PNG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
