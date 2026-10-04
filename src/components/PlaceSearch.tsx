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
  autoFocus?: boolean
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
export default function PlaceSearch({ label, placeholder, onSelect, autoFocus, showLabel = false }: PlaceSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [searching, setSearching] = useState(false)
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places)
          setActive(places.length > 0 ? 0 : -1)
          setSearching(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([])
            setSearching(false)
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
  const status = searching ? 'Searching…' : results.length === 0 ? 'No places found' : null

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
          autoFocus={autoFocus}
          placeholder={placeholder ?? label}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
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
      <ul id={listId} role="listbox" aria-label={label} className="psearch-list" hidden={!expanded}>
        {results.map((place, index) => (
          <li
            key={place.id}
            id={`${listId}-${index}`}
            role="option"
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
          </li>
        ))}
        {status && expanded ? (
          <li className="psearch-status" role="presentation">
            {status}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
