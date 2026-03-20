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
}

function App() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [aspectIndex, setAspectIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [bezelThickness, setBezelThickness] = useState(10)
  const [phoneScale, setPhoneScale] = useState(1)
  const [bezelXOffset, setBezelXOffset] = useState(0)
  const [bezelYOffset, setBezelYOffset] = useState(0)
  const [phoneGap, setPhoneGap] = useState(50)
  const [bezelColor, setBezelColor] = useState('#1a1a1a')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImage = (file: File): Promise<ImageItem> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => resolve({ file, url, img })
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

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].url)
      next.splice(index, 1)
      return next
    })
  }

  const drawCanvas = useCallback((isTransparent = false) => {
    const canvas = canvasRef.current
    if (!canvas || images.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = ASPECT_RATIOS[aspectIndex]
    const CANVAS_WIDTH = ratio.width
    const CANVAS_HEIGHT = ratio.height
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    // Background
    if (!isTransparent) {
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    } else {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    const count = images.length
    const padding = 80
    const gap = phoneGap
    const totalGap = gap * (count - 1)
    const availableWidth = CANVAS_WIDTH - padding * 2 - totalGap
    const slotWidth = availableWidth / count
    const slotHeight = CANVAS_HEIGHT - padding * 2

    // Phone mockup constants
    const bezel = bezelThickness
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

    // First pass: calculate all phone dimensions to determine total width for centering
    const phoneDimensions = images.map((item) => {
      const { img } = item
      const imgAspect = img.naturalWidth / img.naturalHeight
      const screenSlotWidth = gap === 0 ? slotWidth : slotWidth - bezel * 2
      const screenSlotHeight = slotHeight - bezel * 2

      let screenW: number, screenH: number
      if (imgAspect > screenSlotWidth / screenSlotHeight) {
        screenW = screenSlotWidth
        screenH = screenSlotWidth / imgAspect
      } else {
        screenH = screenSlotHeight
        screenW = screenSlotHeight * imgAspect
      }

      const scaledBezel = bezel * phoneScale
      const scaledScreenW = screenW * phoneScale
      const scaledScreenH = screenH * phoneScale
      const scaledCornerRadius = cornerRadius * phoneScale

      const phoneW = scaledScreenW + scaledBezel * 2
      const phoneH = scaledScreenH + scaledBezel * 2

      return {
        phoneW,
        phoneH,
        scaledBezel,
        scaledScreenW,
        scaledScreenH,
        scaledCornerRadius,
      }
    })

    // Calculate total width and center offset
    const totalPhoneWidth = phoneDimensions.reduce((sum, dim) => sum + dim.phoneW, 0) + gap * (count - 1)
    const centerOffsetX = (CANVAS_WIDTH - totalPhoneWidth) / 2

    images.forEach((item, i) => {
      const { img } = item
      const dim = phoneDimensions[i]
      const { phoneW, phoneH, scaledBezel, scaledScreenW, scaledScreenH, scaledCornerRadius } = dim

      const phoneX = centerOffsetX + i * (phoneW + gap) + bezelXOffset
      const phoneY = padding + (slotHeight - phoneH) / 2 + bezelYOffset

      // Shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 10
      roundRect(phoneX, phoneY, phoneW, phoneH, scaledCornerRadius)
      ctx.fillStyle = bezelColor
      ctx.fill()
      ctx.restore()

      // Phone body
      roundRect(phoneX, phoneY, phoneW, phoneH, scaledCornerRadius)
      ctx.fillStyle = bezelColor
      ctx.fill()

      // Screen area (clipped with rounded corners)
      const screenX = phoneX + scaledBezel
      const screenY = phoneY + scaledBezel
      const scaledInnerRadius = scaledCornerRadius - scaledBezel
      ctx.save()
      roundRect(screenX, screenY, scaledScreenW, scaledScreenH, scaledInnerRadius)
      ctx.clip()
      ctx.drawImage(img, screenX, screenY, scaledScreenW, scaledScreenH)
      ctx.restore()

      // Dynamic Island
      const islandWidth = scaledScreenW * 0.28
      const islandHeight = 20 * phoneScale
      const islandX = phoneX + phoneW / 2 - islandWidth / 2
      const islandY = screenY + 14 * phoneScale
      ctx.beginPath()
      ctx.roundRect(islandX, islandY, islandWidth, islandHeight, islandHeight / 2)
      ctx.fillStyle = '#000000'
      ctx.fill()

      // Home bar indicator
      const scaledHomeBarWidth = homeBarWidth * phoneScale
      const barX = phoneX + phoneW / 2 - scaledHomeBarWidth / 2
      const barY = phoneY + phoneH - scaledBezel - 10 * phoneScale
      const scaledHomeBarHeight = homeBarHeight * phoneScale
      ctx.beginPath()
      ctx.roundRect(barX, barY, scaledHomeBarWidth, scaledHomeBarHeight, 2 * phoneScale)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fill()

    })
  }, [images, aspectIndex, bezelThickness, phoneScale, bezelXOffset, bezelYOffset, phoneGap, bezelColor])

  useEffect(() => {
    drawCanvas(false)
  }, [drawCanvas])

  const handleDownload = (isTransparent = false) => {
    drawCanvas(isTransparent)
    setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `screenshots-${ASPECT_RATIOS[aspectIndex].label.replace(':', 'x')}${isTransparent ? '-transparent' : ''}.png`
        a.click()
        URL.revokeObjectURL(url)
        drawCanvas(false)
      }, 'image/png')
    }, 0)
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
    <div className="min-h-screen bg-neutral-950 py-6 sm:py-12 px-3 sm:px-4">
      <main className="max-w-4xl mx-auto">
        <header className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
            SnapBoard
          </h1>
          <p className="text-neutral-500 text-xs sm:text-sm">
            Combine screenshots into beautiful phone mockups — free, no sign-up
          </p>
        </header>
        {/* Hidden SEO content for crawlers */}
        <div className="sr-only" aria-hidden="false">
          <h2>Free Screenshot Combiner &amp; Phone Mockup Generator</h2>
          <p>SnapBoard lets you combine up to 3 screenshots into a single image with realistic iPhone-style device frames. Customize bezel thickness, color, phone gap, and size. Choose from multiple aspect ratios including 16:9, 4:3, 1:1, 3:4, and 9:16. Export as PNG or transparent PNG. Perfect for App Store screenshots, portfolio mockups, social media posts, and product presentations. Runs entirely in your browser with no uploads and no sign-up required.</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => images.length < MAX_IMAGES && fileInputRef.current?.click()}
          className={`border border-dashed rounded-2xl p-6 sm:p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-violet-500 bg-violet-500/10'
              : images.length >= MAX_IMAGES
                ? 'border-neutral-800 bg-neutral-900/50 cursor-not-allowed'
                : 'border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/50'
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
          <div className={`text-4xl mb-3 transition-transform ${isDragging ? 'text-violet-400 scale-125' : 'text-neutral-500 animate-pulse'}`}>+</div>
          <p className="text-neutral-300 text-sm">
            {images.length >= MAX_IMAGES
              ? 'Maximum number of images reached'
              : 'Drag & drop or click to select images'}
          </p>
          <p className="text-neutral-600 text-xs mt-2">
            {images.length} / {MAX_IMAGES}
          </p>
        </div>

        {/* Thumbnails */}
        {images.length > 0 && (
          <div className="flex gap-3 sm:gap-5 mt-8 justify-center">
            {images.map((item, i) => (
              <div key={i} className="relative group">
                <img
                  src={item.url}
                  alt={`Screenshot ${i + 1}`}
                  className="h-24 sm:h-36 rounded-xl object-contain bg-neutral-900 ring-1 ring-neutral-800 transition-transform duration-200 group-hover:-rotate-1 group-hover:scale-105"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 bg-neutral-800 hover:bg-red-500 text-neutral-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {images.length > 0 && (
          <div className="mt-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Preview</h2>
              <div className="flex gap-1 flex-wrap">
                {ASPECT_RATIOS.map((ratio, i) => (
                  <button
                    key={ratio.label}
                    onClick={() => setAspectIndex(i)}
                    className={`px-2.5 sm:px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                      aspectIndex === i
                        ? 'bg-violet-500 text-white'
                        : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="mb-6 p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-3">
              <div>
                <label className="text-xs text-neutral-500 font-medium">Bezel Thickness</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={bezelThickness}
                    onChange={(e) => setBezelThickness(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-neutral-500 w-12">{bezelThickness}px</span>
                  <button
                    onClick={() => setBezelThickness(10)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
                    title="Reset to default"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 font-medium">Bezel Color</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="color"
                    value={bezelColor}
                    onChange={(e) => setBezelColor(e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer border border-neutral-800"
                  />
                  <span className="text-xs text-neutral-500 font-mono flex-1">{bezelColor}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 font-medium">Phone Gap</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min="-300"
                    max="150"
                    step="5"
                    value={phoneGap}
                    onChange={(e) => setPhoneGap(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-neutral-500 w-12">{phoneGap > 0 ? '+' : ''}{phoneGap}px</span>
                  <button
                    onClick={() => setPhoneGap(50)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
                    title="Reset to default"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 font-medium">Phone Size</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={phoneScale}
                    onChange={(e) => setPhoneScale(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-neutral-500 w-12">{(phoneScale * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => setPhoneScale(1)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
                    title="Reset to default"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 font-medium">Position (Horizontal)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min="-300"
                    max="300"
                    step="10"
                    value={bezelXOffset}
                    onChange={(e) => setBezelXOffset(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-neutral-500 w-12">{bezelXOffset > 0 ? '+' : ''}{bezelXOffset}px</span>
                  <button
                    onClick={() => setBezelXOffset(0)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
                    title="Reset to default"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 font-medium">Position (Vertical)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min="-300"
                    max="300"
                    step="10"
                    value={bezelYOffset}
                    onChange={(e) => setBezelYOffset(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-neutral-500 w-12">{bezelYOffset > 0 ? '+' : ''}{bezelYOffset}px</span>
                  <button
                    onClick={() => setBezelYOffset(0)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors p-1"
                    title="Reset to default"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
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
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => handleDownload(false)}
                className="bg-violet-500 hover:bg-violet-400 text-white font-medium py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                Download PNG
              </button>
              <button
                onClick={() => handleDownload(true)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                Download PNG (Transparent)
              </button>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-4xl mx-auto mt-12 pt-6 border-t border-neutral-800 text-center">
        <p className="text-neutral-600 text-xs">
          © {new Date().getFullYear()} SnapBoard · Free screenshot mockup tool · No uploads, 100% in-browser
        </p>
      </footer>
    </div>
  )
}

export default App
