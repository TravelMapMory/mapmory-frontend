import { Clock, CircleX, MapPin, Search as SearchIcon } from 'lucide-react'
import './Search.css'

/**
 * Which glyph a result row shows: 'place' is a geocoder match (map pin),
 * 'recent' is something the user searched before (clock).
 */
export type SearchResultIcon = 'place' | 'recent'

/**
 * One row of the search dropdown. `id` identifies the row for selection so the
 * selected state is data-driven rather than positional.
 */
export interface SearchResult {
  id: string
  label: string
  icon: SearchResultIcon
}

/**
 * Props of the map search control. The field is fully controlled, and
 * `selectedId` — not row order — decides which row renders as selected.
 */
export interface SearchProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  results: SearchResult[]
  selectedId: string | null
  onSelect: (result: SearchResult) => void
}

/**
 * The three rows shipped by the design, exported so the integrator can render
 * the control immediately without wiring a geocoder first.
 */
export const SEARCH_RESULTS: SearchResult[] = [
  { id: 'paris', label: 'Paris, France', icon: 'place' },
  { id: 'eiffel-tower', label: 'Eiffel Tower, France', icon: 'place' },
  { id: 'the-louvre', label: 'the Louvre, France', icon: 'recent' },
]

/**
 * The 24-space `strokeWidth` that renders the design's 2px stroke at an icon
 * drawn `size` px wide, because Lucide always strokes inside a 24 viewBox.
 */
function stroke(size: number): number {
  return 48 / size
}

/**
 * Size of both dropdown row glyphs, read from the design nodes themselves —
 * 2:120 for the selected row's pin and 2:132 for the recent row's clock, both
 * 16px. The exported SVG in the repo was a 14px pin from a different frame.
 */
const ROW_ICON_SIZE = 16

/**
 * Map search: a rounded field with the query and a clear button, plus a
 * floating card of result rows. The dropdown is omitted when there are no
 * results so the field can stand alone. Icon colour comes from CSS via
 * `currentColor`, so the selected row tints its own pin.
 */
export default function Search({
  value,
  onChange,
  onClear,
  results,
  selectedId,
  onSelect,
}: SearchProps) {
  return (
    <div className="srch">
      <div className="srch-field">
        <SearchIcon className="srch-icon-field" size={20} strokeWidth={stroke(20)} aria-hidden />
        <input
          className="srch-input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Search"
        />
        <button className="srch-clear" type="button" onClick={onClear} aria-label="Clear search">
          <CircleX size={10} strokeWidth={stroke(10)} aria-hidden />
        </button>
      </div>
      {results.length > 0 && (
        <ul className="srch-list">
          {results.map((result) => {
            const selected = result.id === selectedId
            return (
              <li key={result.id}>
                <button
                  className={selected ? 'srch-row srch-row-selected' : 'srch-row'}
                  type="button"
                  onClick={() => onSelect(result)}
                  aria-current={selected}
                >
                  {result.icon === 'recent' ? (
                    <Clock
                      className="srch-icon-clock"
                      size={ROW_ICON_SIZE}
                      strokeWidth={stroke(ROW_ICON_SIZE)}
                      aria-hidden
                    />
                  ) : (
                    <MapPin
                      className="srch-icon-pin"
                      size={ROW_ICON_SIZE}
                      strokeWidth={stroke(ROW_ICON_SIZE)}
                      aria-hidden
                    />
                  )}
                  <span className="srch-row-label">{result.label}</span>
                  {selected && <span className="eyebrow srch-badge">ACTIVE</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
