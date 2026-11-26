import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Earth, MapPin, Search as SearchIcon, X } from 'lucide-react'
import { searchPlaces } from '../api/client'
import type { Place } from '../api/types'
import './PlaceSearch.css'

export interface PlaceSearchProps {
  /** Accessible name of the field, e.g. "Find a place". */
  label: string
  placeholder?: string
  onSelect: (place: Place) => void
  focusOnMount?: boolean
  /** Shows the label above the field instead of only to screen readers. */
  showLabel?: boolean
}

/** Doc 5.2: place search is rate-limited, so the browser waits for a pause in typing. */
const DEBOUNCE_MS = 300

/**
 * World-place search (`GET /api/places/search`) as an ARIA 1.2 combobox:
 * arrow keys move through the results, Enter picks one, Escape closes the
 * list. Used by "Find a place" on the map and by location correction.
 */
export default function PlaceSearch({ label, placeholder, onSelect, focusOnMount, showLabel = false }: PlaceSearchProps) {
  const [query, setQuery] = useState('')
  /** The newest search to finish; it counts only while its query is still the one typed. */
  const [settled, setSettled] = useState<{ query: string; results: Place[]; failed: boolean } | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)

  // A field opened by the owner's own action takes focus once, as autoFocus would, so they can type at once.
  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus()
  }, [focusOnMount])

  const [activeQuery, setActiveQuery] = useState(query)
  if (activeQuery !== query) {
    setActiveQuery(query)
    setActive(-1)
    setSettled(null)
  }
  const current = settled?.query === query ? settled : null
  const results = current?.results ?? []
  const failed = current?.failed ?? false
  const searching = query.trim().length >= 2 && current === null

  useEffect(() => {
    if (query.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((places) => {
          setSettled({ query, results: places, failed: false })
          setActive(places.length > 0 ? 0 : -1)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSettled({ query, results: [], failed: true })
            setActive(-1)
          }
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function choose(place: Place) {
    onSelect(place)
    setQuery(place.label)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => (results.length === 0 ? -1 : (i + 1) % results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (results.length === 0 ? -1 : (i - 1 + results.length) % results.length))
    } else if (event.key === 'Enter') {
      if (open && active >= 0 && results[active]) {
        event.preventDefault()
        choose(results[active])
      }
    } else if (event.key === 'Escape') {
      if (open) {
        // Only this field's list closes; a surrounding form or drawer keeps its own Escape.
        event.stopPropagation()
        setOpen(false)
      }
    }
  }

  const expanded = open && query.trim().length >= 2
  const status = searching ? 'Searching…' : failed ? 'Place search could not be loaded. Try another search.' : results.length === 0 ? 'No places found' : null

  return (
    <div className="psearch">
      <label htmlFor={id} className={showLabel ? 'psearch-label' : 'visually-hidden'}>
        {label}
      </label>
      <div className="psearch-field">
        <SearchIcon size={16} aria-hidden className="psearch-icon" />
        <input
          ref={inputRef}
          id={id}
          className="psearch-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder ?? label}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="psearch-clear"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      <div id={listId} role="listbox" aria-label={label} className="psearch-list" hidden={!expanded}>
        {results.map((place, index) => (
          <div
            key={place.id}
            id={`${listId}-${index}`}
            role="option"
            tabIndex={-1}
            aria-selected={index === active}
            className="psearch-option"
            // mousedown, not click: click would arrive after the input's blur closed the list.
            onMouseDown={(event) => {
              event.preventDefault()
              choose(place)
            }}
            onMouseEnter={() => setActive(index)}
          >
            {place.kind === 'country' ? <Earth size={14} aria-hidden /> : <MapPin size={14} aria-hidden />}
            <span>{place.label}</span>
          </div>
        ))}
        {status && expanded ? (
          <div className="psearch-status" role="presentation">
            {status}
          </div>
        ) : null}
      </div>
    </div>
  )
}
