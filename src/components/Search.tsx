import searchIconUrl from '../assets/search/search.svg'
import clearIconUrl from '../assets/search/x-circle.svg'
import pinIconUrl from '../assets/search/map-pin.svg'
import pinActiveIconUrl from '../assets/search/map-pin-active.svg'
import clockIconUrl from '../assets/search/clock.svg'
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
 * Returns the icon url for a row, picking the green pin for the selected row
 * because an SVG's fill cannot inherit the row's state through an <img>.
 */
function rowIconUrl(icon: SearchResultIcon, selected: boolean): string {
  if (icon === 'recent') {
    return clockIconUrl
  }
  return selected ? pinActiveIconUrl : pinIconUrl
}

/**
 * Map search: a rounded field with the query and a clear button, plus a
 * floating card of result rows. The dropdown is omitted when there are no
 * results so the field can stand alone.
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
        <img className="srch-icon" src={searchIconUrl} alt="" width={20} height={20} />
        <input
          className="srch-input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Search"
        />
        <button className="srch-clear" type="button" onClick={onClear} aria-label="Clear search">
          <img src={clearIconUrl} alt="" width={12} height={12} />
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
                  <img
                    className="srch-icon"
                    src={rowIconUrl(result.icon, selected)}
                    alt=""
                    width={16}
                    height={16}
                  />
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
