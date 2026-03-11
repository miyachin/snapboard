import { useState, useRef, useCallback, useEffect } from 'react'

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080
const MAX_IMAGES = 3

interface ImageItem {
  file: File
  url: string
  img: HTMLImageElement
  caption: string
}

function App() {
  const [images, setImages] = useState<ImageItem[]>([])
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

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const count = images.length
    const padding = 40
    const gap = 30
    const captionHeight = 100
    const totalGap = gap * (count - 1)
    const availableWidth = CANVAS_WIDTH - padding * 2 - totalGap
    const slotWidth = availableWidth / count
    const slotHeight = CANVAS_HEIGHT - padding * 2 - captionHeight

    images.forEach((item, i) => {
      const { img, caption } = item
      const imgAspect = img.naturalWidth / img.naturalHeight
      const slotAspect = slotWidth / slotHeight

      let drawWidth: number, drawHeight: number
      if (imgAspect > slotAspect) {
        drawWidth = slotWidth
        drawHeight = slotWidth / imgAspect
      } else {
        drawHeight = slotHeight
        drawWidth = slotHeight * imgAspect
      }

      const slotX = padding + i * (slotWidth + gap)
      const x = slotX + (slotWidth - drawWidth) / 2
      const y = padding + (slotHeight - drawHeight) / 2

      ctx.drawImage(img, x, y, drawWidth, drawHeight)

      // Border
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, drawWidth, drawHeight)

      // Caption with word wrap
      if (caption) {
        ctx.fillStyle = '#6b7280'
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
  }, [images])

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
      a.download = 'screenshots-16x9.png'
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
          Screenshot Combiner
        </h1>
        <p className="text-gray-500 text-center mb-8">
          スクショを最大3枚アップロードして、16:9の画像に横並べで出力します
        </p>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => images.length < MAX_IMAGES && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : images.length >= MAX_IMAGES
                ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-100'
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
          <div className="text-gray-400 text-5xl mb-3">+</div>
          <p className="text-gray-600 font-medium">
            {images.length >= MAX_IMAGES
              ? '最大枚数に達しました'
              : 'ドラッグ&ドロップ または クリックして画像を選択'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {images.length} / {MAX_IMAGES} 枚
          </p>
        </div>

        {/* Thumbnails + Captions */}
        {images.length > 0 && (
          <div className="flex gap-4 mt-6 justify-center">
            {images.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="relative group">
                  <img
                    src={item.url}
                    alt={`Screenshot ${i + 1}`}
                    className="h-32 rounded-lg shadow object-contain bg-white"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={`キャプション ${i + 1}`}
                  value={item.caption ?? ''}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  className="w-36 text-sm text-center border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {images.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">プレビュー</h2>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full rounded border border-gray-200"
              />
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={handleDownload}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
              >
                PNG をダウンロード
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
