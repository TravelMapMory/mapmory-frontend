import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Layers } from 'lucide-react'
import { BASEMAPS, type Basemap } from '../mapTiles'
import './MapLayers.css'

const ORDER = Object.keys(BASEMAPS) as Basemap[]

/**
 * The map's layers button: one icon that opens a small panel of basemaps, each
 * with a preview tile, like the layers control of common map apps. The panel
 * follows the button in tab order and closes on a choice, Escape, a click
 * outside or focus moving elsewhere; a choice or Escape returns focus to the button.
 */
export default function MapLayers({ value, onChange }: { value: Basemap; onChange: (next: Basemap) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  /** Closes the panel and puts focus back on the layers button. */
  function close() {
    setOpen(false)
    button.current?.focus()
  }

  /** Applies a basemap and closes the panel. */
  function choose(next: Basemap) {
    onChange(next)
    close()
  }

  /** Escape on the button or inside the panel closes it, without reaching other Escape handlers on the screen. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close()
    }
  }

  return (
    <div
      className="map-layers"
      ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        className="map-layers-button"
        aria-label={`Map style: ${BASEMAPS[value].label}`}
        title="Map style"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <Layers size={20} aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="map-layers-panel" role="group" aria-label="Map style" onKeyDown={onKeyDown}>
          {ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className="map-layers-option"
              aria-pressed={value === key}
              onClick={() => choose(key)}
            >
              <img src={BASEMAPS[key].thumb} alt="" data-desaturate={BASEMAPS[key].desaturate} />
              <span>{BASEMAPS[key].label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
