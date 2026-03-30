import { useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Image as ImageIcon, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  /** Called with { displayUrl, filePath } when an image is selected, or null when cleared. */
  onImageSelect: (image: { displayUrl: string; filePath: string } | null) => void
  /** The blob/data URL used for the <img> preview. */
  displayUrl: string | null
  /** The original filename (for display). */
  fileName: string | null
}

/**
 * Copy a File to a temp folder via Electron IPC and return the absolute path.
 * Falls back to file.path (resolved) if IPC is unavailable.
 */
async function stageFileToTemp(file: File): Promise<string | null> {
  try {
    if (window.electronAPI?.saveImageToTemp) {
      const buffer = await file.arrayBuffer()
      const result = await window.electronAPI.saveImageToTemp(buffer, file.name)
      if (result.success && result.path) return result.path
    }
  } catch {
    // Fall through to file.path fallback
  }
  // Fallback: use Electron's file.path (may be relative)
  const rawPath = (file as any).path as string | undefined
  if (rawPath) {
    return window.electronAPI?.resolvePath(rawPath) ?? rawPath
  }
  return null
}

export function ImageUploader({ onImageSelect, displayUrl, fileName }: ImageUploaderProps) {
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const blobUrl = URL.createObjectURL(file)
    blobUrlRef.current = blobUrl

    const filePath = await stageFileToTemp(file)
    onImageSelect({ displayUrl: blobUrl, filePath: filePath || '' })
  }, [onImageSelect])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    noClick: !!displayUrl,
  })

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    onImageSelect(null)
  }

  const replaceImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    open()
  }

  const getDisplayName = (name: string | null): string => {
    if (!name) return ''
    const maxLength = 28
    if (name.length <= maxLength) return name
    const ext = name.split('.').pop() || ''
    const baseName = name.slice(0, name.length - ext.length - 1)
    const truncatedBase = baseName.slice(0, maxLength - ext.length - 4)
    return `${truncatedBase}...${ext ? '.' + ext : ''}`
  }

  return (
    <div className="w-full">
      <label className="block text-[12px] font-semibold text-zinc-500 mb-2 uppercase leading-4">
        Image
      </label>
      <div
        {...getRootProps()}
        className={cn(
          'relative border border-dashed border-zinc-600 rounded-lg cursor-pointer transition-colors',
          'hover:border-zinc-500',
          isDragActive && 'border-blue-500 bg-blue-500/5',
          displayUrl ? 'p-3' : 'p-6'
        )}
      >
        <input {...getInputProps()} />
        {displayUrl ? (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 flex-shrink-0 rounded-md overflow-hidden bg-zinc-800">
              <img src={displayUrl} alt="Selected" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate" title={fileName || ''}>
                {getDisplayName(fileName)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={clearImage} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors" title="Remove image">
                <Trash2 className="h-5 w-5 text-zinc-400 hover:text-white" />
              </button>
              <button onClick={replaceImage} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors" title="Replace image">
                <RefreshCw className="h-5 w-5 text-zinc-400 hover:text-white" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-700 rounded-lg">
              {isDragActive ? <Upload className="h-6 w-6 text-blue-400" /> : <ImageIcon className="h-6 w-6 text-zinc-400" />}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Drag image file here</p>
              <p className="text-sm text-zinc-500">Or <span className="text-blue-400 underline">upload a file</span></p>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 mt-2">png, jpeg, webp. Max size is 10MB</p>
    </div>
  )
}
