import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { MapNote } from '@/types'
import styles from './NoteEditor.module.css'

interface Props {
  mapId: number
  mediaId?: number
  noteType: MapNote['note_type']
}

export default function NoteEditor({ mapId, mediaId, noteType }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/maps/${mapId}/notes`, {
        note_type: noteType,
        media_id: mediaId ?? null,
        title: title || null,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', String(mapId)] })
      setOpen(false)
      setTitle('')
      setBody('')
      toast.success('Note saved.')
    },
    onError: () => toast.error('Failed to save note.'),
  })

  if (!open) {
    return (
      <button
        type="button"
        className={`btn btn-secondary ${styles.addBtn}`}
        onClick={() => setOpen(true)}
        aria-expanded="false"
        aria-controls="note-editor-form"
      >
        + Add note
      </button>
    )
  }

  return (
    <div id="note-editor-form" className={`card ${styles.editor}`} role="region" aria-label="Note editor">
      <h3 className={styles.editorTitle}>Add a note</h3>
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
        aria-label="Note form"
      >
        <div className="form-group">
          <label htmlFor="note-title" className="form-label">Title <span className={styles.optional}>(optional)</span></label>
          <input
            id="note-title"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="form-group">
          <label htmlFor="note-body" className="form-label">Note <span aria-hidden="true">*</span></label>
          <textarea
            id="note-body"
            className="form-textarea"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            aria-required="true"
            maxLength={5000}
          />
          <p className={styles.charCount} aria-live="polite" aria-atomic="true">
            {body.length} / 5000
          </p>
        </div>
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={!body.trim() || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save note'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
