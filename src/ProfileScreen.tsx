import ProfileSidebar, { PROFILE_SIDEBAR_EXAMPLE } from './components/ProfileSidebar'
import ProfileMain, { profileMainExample } from './components/ProfileMain'
import helsinkiPhoto from './assets/pins/helsinki.jpg'
import londonPhoto from './assets/pins/london.jpg'
import berlinPhoto from './assets/pins/berlin.jpg'
import romePhoto from './assets/pins/rome.jpg'
import parisPhoto from './assets/pins/paris.jpg'
import parisWidePhoto from './assets/pins/paris-wide.jpg'
import './ProfileScreen.css'

/**
 * Stand-in photographs for the journey hero, the city chips and the pinboard.
 *
 * They are supplied here rather than inside ProfileMain because the component is
 * a translation of the Figma node and should not decide which pictures a screen
 * shows. The hero uses a separate 16:9 crop: the square sources the pins share
 * would centre-crop to sky and girders in a wide slot. The design's own photographs were never exported by Figma; see
 * CREDITS.md for each replacement's author and licence.
 */
const CITY_PHOTOS: Record<string, string> = {
  Helsinki: helsinkiPhoto,
  London: londonPhoto,
  Berlin: berlinPhoto,
  Rome: romePhoto,
  Paris: parisPhoto,
}

/**
 * The profile page body (Figma node 8:4, "unimap-profile-info"): a fixed 400px
 * identity column beside the stats, journey, cities and pinboard column.
 *
 * The header is not rendered here — it is shared with the map screen and so is
 * owned by the app shell.
 */
export default function ProfileScreen() {
  const noop = () => undefined

  const journey = {
    ...profileMainExample.journey,
    photos: [{ src: parisWidePhoto, alt: 'Paris seen from above, with the Eiffel Tower' }],
  }

  const topCities = profileMainExample.topCities.map((city) => ({
    ...city,
    thumb: CITY_PHOTOS[city.name] ?? city.thumb,
  }))

  const pinboard = [
    { src: helsinkiPhoto, alt: 'Helsinki Cathedral' },
    { src: berlinPhoto, alt: 'The Brandenburg Gate, Berlin' },
    { src: londonPhoto, alt: 'The Palace of Westminster, London' },
    { src: romePhoto, alt: 'The Colosseum, Rome' },
  ]

  return (
    <div className="profile">
      <ProfileSidebar
        {...PROFILE_SIDEBAR_EXAMPLE}
        onEditProfile={noop}
        onSelectPreference={noop}
      />
      <ProfileMain
        {...profileMainExample}
        journey={journey}
        topCities={topCities}
        pinboard={pinboard}
      />
    </div>
  )
}
