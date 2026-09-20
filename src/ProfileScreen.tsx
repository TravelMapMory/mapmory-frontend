import ProfileSidebar, { PROFILE_SIDEBAR_EXAMPLE } from './components/ProfileSidebar'
import ProfileMain, { profileMainExample } from './components/ProfileMain'
import './ProfileScreen.css'

/**
 * The profile page body (Figma node 8:4, "unimap-profile-info"): a fixed 400px
 * identity column beside the stats, journey, cities and pinboard column.
 *
 * The header is not rendered here — it is shared with the map screen and so is
 * owned by the app shell.
 */
export default function ProfileScreen() {
  const noop = () => undefined

  return (
    <div className="profile">
      <ProfileSidebar
        {...PROFILE_SIDEBAR_EXAMPLE}
        onEditProfile={noop}
        onSelectPreference={noop}
      />
      <ProfileMain {...profileMainExample} />
    </div>
  )
}
