import { useId, useState } from 'react'
import { Upload } from 'lucide-react'
import './UploadPanel.css'

/** Shared file selection and drop area for Dashboard and Trip uploads. */
export default function UploadDropZone({ onFiles, inputClassName = '' }: {
  onFiles: (files: File[]) => void
  inputClassName?: string
}) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  return (
      <div
        className="upl-drop"
        data-dragging={dragging}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          onFiles([...event.dataTransfer.files])
        }}
      >
        <Upload size={24} aria-hidden />
        <p>
          Drop JPEG or PNG photos here, or{' '}
          <label htmlFor={inputId} className="upl-choose">
            choose files
          </label>
          . Up to 25 MB each.
        </p>
        <input
          id={inputId}
          className={`visually-hidden ${inputClassName}`}
          type="file"
          multiple
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          onChange={(event) => {
            onFiles([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
        <p className="upl-note">
          MapMory reads each photo's capture time and GPS from its metadata. Phones often remove the location when
          you pick photos in the browser, so for past trips upload from a computer. Photos without a location stay in
          the gallery and wait for you to place them.
        </p>
      </div>
  )
}
