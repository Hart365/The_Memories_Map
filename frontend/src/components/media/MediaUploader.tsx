import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import FocusTrap from 'focus-trap-react'
import { createPortal } from 'react-dom'
import api from '@/lib/api'
import styles from './MediaUploader.module.css'

interface Props {
  mapId: number
  onClose: () => void
}

type FileStatus = 'pending' | 'success' | 'duplicate' | 'error'

const ACCEPTED = '.jpg,.jpeg,.png,.gif,.webp,.heic,.mp4,.mov,.avi,.mkv,.m4v'
const MAX_BATCH_SIZE_MB = 400 // Stay under 512MB server limit with buffer

export default function MediaUploader({ mapId, onClose }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    
    // Filter out duplicates (files already in the queue)
    const existingNames = new Set(files.map(f => f.name))
    const newFiles = dropped.filter(f => !existingNames.has(f.name))
    
    if (newFiles.length < dropped.length) {
      const dupeCount = dropped.length - newFiles.length
      toast(`Skipped ${dupeCount} duplicate file${dupeCount > 1 ? 's' : ''} already in queue`, {
        icon: 'ℹ️',
        duration: 3000
      })
    }
    
    setFiles([...files, ...newFiles])
    setFileStatuses([...fileStatuses, ...new Array(newFiles.length).fill('pending')])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    
    // Check for browser file selection limit warning
    if (e.target.files && e.target.files.length >= 1000) {
      toast('Browser selected 1000+ files. You may be hitting browser limits. Select files in smaller batches.', {
        duration: 6000,
        icon: '⚠️'
      })
    }
    
    // Filter out duplicates (files already in the queue)
    const existingNames = new Set(files.map(f => f.name))
    const newFiles = selected.filter(f => !existingNames.has(f.name))
    
    if (newFiles.length < selected.length) {
      const dupeCount = selected.length - newFiles.length
      toast(`Skipped ${dupeCount} duplicate file${dupeCount > 1 ? 's' : ''} already in queue`, {
        icon: 'ℹ️',
        duration: 3000
      })
    }
    
    setFiles([...files, ...newFiles])
    setFileStatuses([...fileStatuses, ...new Array(newFiles.length).fill('pending')])
    
    // Reset the input so the same files can be selected again if needed
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setFileStatuses((prev) => prev.filter((_, i) => i !== index))
  }

  /**
   * Split files into batches based on size limit
   */
  const createBatches = (files: File[]): File[][] => {
    const batches: File[][] = []
    let currentBatch: File[] = []
    let currentBatchSize = 0
    const maxBatchBytes = MAX_BATCH_SIZE_MB * 1024 * 1024

    for (const file of files) {
      // If adding this file would exceed limit, start new batch
      if (currentBatch.length > 0 && currentBatchSize + file.size > maxBatchBytes) {
        batches.push(currentBatch)
        currentBatch = []
        currentBatchSize = 0
      }

      currentBatch.push(file)
      currentBatchSize += file.size
    }

    // Add final batch if not empty
    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    return batches
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)
    setUploadComplete(false)

    // Create batches based on file size
    const batches = createBatches(files)
    setTotalBatches(batches.length)

    const totalSizeMB = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024
    console.log(`Uploading ${files.length} files (${totalSizeMB.toFixed(2)} MB total) in ${batches.length} batch(es)`)
    batches.forEach((batch, i) => {
      const batchSizeMB = batch.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024
      console.log(`  Batch ${i + 1}: ${batch.length} files, ${batchSizeMB.toFixed(2)} MB`)
    })

    const newStatuses = new Array(files.length).fill('pending') as FileStatus[]
    let fileOffset = 0
    let totalCreated = 0
    let totalSkipped = 0

    try {
      // Upload each batch sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        setCurrentBatch(batchIndex + 1)

        console.log(`Uploading batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`)

        const form = new FormData()
        batch.forEach((f) => form.append('files[]', f))

        const batchStartIndex = fileOffset

        try {
          const axiosResponse = await api.post(`/maps/${mapId}/media`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => {
              if (e.total) {
                const batchProgress = (e.loaded / e.total) * 100
                const overallProgress = 
                  ((batchIndex * 100 + batchProgress) / batches.length)
                setProgress(Math.round(overallProgress))
              }
            },
          })

          const data = axiosResponse.data
          const response = data as {
            data?: unknown[]
            duplicates?: string[]
            created_count?: number
            skipped_count?: number
          }

          const createdCount = response.created_count ?? response.data?.length ?? 0
          const duplicates = response.duplicates ?? []
          const skippedCount = response.skipped_count ?? duplicates.length

          totalCreated += createdCount
          totalSkipped += skippedCount

          // Mark statuses for this batch
          const duplicateSet = new Set(duplicates.map(d => d.toLowerCase()))
          for (let i = 0; i < batch.length; i++) {
            const fileIndex = batchStartIndex + i
            newStatuses[fileIndex] = duplicateSet.has(batch[i].name.toLowerCase()) 
              ? 'duplicate' 
              : 'success'
          }

          console.log(`Batch ${batchIndex + 1} complete: ${createdCount} created, ${skippedCount} skipped`)
        } catch (batchError) {
          console.error(`Batch ${batchIndex + 1} failed:`, batchError)
          // Mark this batch's files as errors
          for (let i = 0; i < batch.length; i++) {
            newStatuses[batchStartIndex + i] = 'error'
          }

          const status = (batchError as { response?: { status?: number } })?.response?.status
          if (status === 413) {
            toast.error(`Batch ${batchIndex + 1} too large. Try selecting fewer files at once.`)
          } else {
            toast.error(`Batch ${batchIndex + 1} failed. Continuing with remaining batches...`)
          }
        }

        fileOffset += batch.length
      }

      // Update all statuses at once
      setFileStatuses(newStatuses)
      setUploadComplete(true)
      setProgress(100)

      // Refresh media list
      qc.invalidateQueries({ queryKey: ['media', String(mapId)] })
      qc.refetchQueries({ queryKey: ['media', String(mapId)] })

      // Count errors
      const errorCount = newStatuses.filter(s => s === 'error').length

      // Show summary
      if (errorCount > 0) {
        toast.error(`Upload completed with errors: ${totalCreated} succeeded, ${totalSkipped} duplicates, ${errorCount} failed. Check the list for details.`, {
          duration: 8000
        })
      } else if (totalCreated === 0 && totalSkipped > 0) {
        toast.error(`No files uploaded. All ${totalSkipped} file(s) were duplicates.`)
      } else if (totalSkipped > 0) {
        toast.success(`${totalCreated} file${totalCreated > 1 ? 's' : ''} uploaded, ${totalSkipped} skipped (duplicates)`)
      } else {
        toast.success(`${totalCreated} file${totalCreated > 1 ? 's' : ''} uploaded successfully!`)
      }
    } catch (err: unknown) {
      console.error('Upload error:', err)
      const fallbackMessage = (err as { message?: string })?.message ?? 'Unknown error'
      toast.error(`Upload failed: ${fallbackMessage}`)
      setFileStatuses(files.map(() => 'error'))
      setUploadComplete(true)
    } finally {
      setUploading(false)
      setCurrentBatch(0)
      setTotalBatches(0)
    }
  }

  return createPortal(
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
            <button 
              type="button" 
              className={styles.closeBtn} 
              onClick={onClose} 
              aria-label="Close upload panel"
              disabled={uploading}
            >
              ✕
            </button>
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
            <p className={styles.dropHint}>
              Supports JPG, PNG, GIF, WEBP, HEIC, MP4, MOV, AVI, MKV
              <br />
              <em>Tip: You can select files multiple times to add more (browser limits: ~1000 files per selection)</em>
              {files.length > 0 && (
                <>
                  <br />
                  <strong>{files.length} file{files.length !== 1 ? 's' : ''} queued for upload</strong>
                </>
              )}
            </p>
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
                  {uploadComplete && (
                    <span className={styles.statusIcon} aria-label={fileStatuses[i]}>
                      {fileStatuses[i] === 'success' && <span className={styles.successIcon}>✓</span>}
                      {(fileStatuses[i] === 'duplicate' || fileStatuses[i] === 'error') && (
                        <span className={styles.errorIcon}>✕</span>
                      )}
                    </span>
                  )}
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.fileSize}>{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  {!uploadComplete && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${f.name}`}
                      disabled={uploading}
                      title="Remove file"
                    >
                      🗑️
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {uploading && (
            <>
              {totalBatches > 1 && (
                <p className={styles.batchInfo} aria-live="polite">
                  Uploading batch {currentBatch} of {totalBatches}
                </p>
              )}
              <div className={styles.progressWrapper} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                <span className="sr-only">{progress}% uploaded</span>
              </div>
            </>
          )}

          <div className={styles.footer}>
            {!uploadComplete ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={files.length === 0 || uploading}
                  aria-busy={uploading}
                >
                  {uploading ? `Uploading… ${progress}%` : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
                </button>
                {files.length > 0 && !uploading && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setFiles([])
                      setFileStatuses([])
                      toast('Queue cleared', { icon: '🗑️' })
                    }}
                    title="Clear all files from queue"
                  >
                    Clear All
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>Cancel</button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>,
    document.body,
  )
}
