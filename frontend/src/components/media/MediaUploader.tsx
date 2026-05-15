import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import FocusTrap from 'focus-trap-react'
import api from '@/lib/api'
import styles from './MediaUploader.module.css'

interface Props {
  mapId: number
  onClose: () => void
}

const ACCEPTED = '.jpg,.jpeg,.png,.gif,.webp,.heic,.mp4,.mov,.avi,.mkv,.m4v'

export default function MediaUploader({ mapId, onClose }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...dropped])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selected])
  }

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setProgress(0)

    const form = new FormData()
    files.forEach((f) => form.append('files[]', f))

    try {
      await api.post(`/maps/${mapId}/media`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      qc.invalidateQueries({ queryKey: ['media', String(mapId)] })
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded!`)
      onClose()
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <FocusTrap>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="uploader-title"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <h2 id="uploader-title" className={styles.title}>Add media</h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close upload panel">✕</button>
          </div>

          {/* Drop zone */}
          <div
            className={styles.dropZone}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            role="region"
            aria-label="Drag and drop upload area"
          >
            <p className={styles.dropText}>Drag &amp; drop files here, or</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => inputRef.current?.click()}
            >
              Browse files
            </button>
            <p className={styles.dropHint}>Supports JPG, PNG, GIF, WEBP, HEIC, MP4, MOV, AVI, MKV</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              onChange={handleFileChange}
              className={styles.hiddenInput}
              aria-label="Select media files to upload"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className={styles.fileList} role="list" aria-label="Selected files">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className={styles.fileItem}>
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.fileSize}>{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.name}`}
                    disabled={uploading}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {uploading && (
            <div className={styles.progressWrapper} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              <span className="sr-only">{progress}% uploaded</span>
            </div>
          )}

          <div className={styles.footer}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              aria-busy={uploading}
            >
              {uploading ? `Uploading… ${progress}%` : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>Cancel</button>
          </div>
        </div>
      </div>
    </FocusTrap>
  )
}
