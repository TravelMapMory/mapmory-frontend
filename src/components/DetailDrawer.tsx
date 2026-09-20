import sparkleIcon from '../assets/drawer/sparkle.svg';
import heartIcon from '../assets/drawer/heart.svg';
import shareIcon from '../assets/drawer/share.svg';
import chevronIcon from '../assets/drawer/chevron-right.svg';
import chevronFaintIcon from '../assets/drawer/chevron-right-faint.svg';
import mapPinIcon from '../assets/drawer/map-pin.svg';
import calendarIcon from '../assets/drawer/calendar.svg';
import uploadIcon from '../assets/drawer/upload.svg';
import globeIcon from '../assets/drawer/globe.svg';
import pictureIcon from '../assets/drawer/picture.svg';
import slidersIcon from '../assets/drawer/sliders.svg';
import userIcon from '../assets/drawer/user.svg';
import plusIcon from '../assets/drawer/plus.svg';
import './DetailDrawer.css';

/**
 * One person a memory is shared with, rendered as a round avatar in the
 * drawer's "SHARED WITH" row.
 */
export interface DrawerPerson {
  name: string;
  avatar: string;
}

/**
 * The content the drawer displays. Everything here is data owned by the host
 * app; the drawer supplies only the design's static labels around it.
 */
export interface DrawerMemory {
  badge: string;
  title: string;
  location: string;
  photos: string[];
  tripDate: string;
  countries: number;
  pictures: number;
  accounts: number;
  sharedWith: DrawerPerson[];
}

/**
 * The strings the Figma node ships, exported so screens and stories can render
 * the drawer exactly as designed. `photos` and `sharedWith` are empty because
 * the design's bitmaps live in Figma, not in this repo — the host app passes
 * its own image URLs.
 */
export const featuredMemory: DrawerMemory = {
  badge: 'FEATURED MEMORY',
  title: 'My Memory Stream: Latest Vantaa snapshot',
  location: 'Paris, France',
  photos: [],
  tripDate: '12 Feb 2024',
  countries: 20,
  pictures: 1500,
  accounts: 0,
  sharedWith: [],
};

/**
 * Content plus one callback per interactive affordance. The carousel is
 * controlled: the parent owns which photo is active so the drawer stays a
 * pure view of `memory`.
 */
export interface DetailDrawerProps {
  memory: DrawerMemory;
  activePhoto: number;
  onSelectPhoto: (index: number) => void;
  onFavorite: () => void;
  onShare: () => void;
  onExpand: () => void;
  onUpload: () => void;
  onOpenPreferences: () => void;
  onAddPerson: () => void;
}

/**
 * The desktop detail drawer for a single memory (Figma node 2:70,
 * "detail-drawer", 420x824): featured badge and quick actions, title and
 * place, photo carousel, trip date, the upload call to action, the profile
 * stats card and the people the memory is shared with.
 */
function DetailDrawer({
  memory,
  activePhoto,
  onSelectPhoto,
  onFavorite,
  onShare,
  onExpand,
  onUpload,
  onOpenPreferences,
  onAddPerson,
}: DetailDrawerProps) {
  const photo = memory.photos[activePhoto];
  const stats = [
    { icon: globeIcon, value: memory.countries, label: 'Countries' },
    { icon: pictureIcon, value: memory.pictures, label: 'Pictures' },
    { icon: slidersIcon, value: memory.accounts, label: 'Accounts' },
  ];

  return (
    <aside className="drawer">
      <div className="drawer-hdr">
        <span className="drawer-badge eyebrow">
          <img className="drawer-badge-icon" src={sparkleIcon} alt="" />
          {memory.badge}
        </span>
        <div className="drawer-hdr-actions">
          <button type="button" className="drawer-icon-btn" onClick={onFavorite} aria-label="Favorite this memory">
            <img src={heartIcon} alt="" />
          </button>
          <button type="button" className="drawer-icon-btn" onClick={onShare} aria-label="Share this memory">
            <img src={shareIcon} alt="" />
          </button>
          <button type="button" className="drawer-icon-btn" onClick={onExpand} aria-label="Open this memory">
            <img src={chevronIcon} alt="" />
          </button>
        </div>
      </div>

      <div className="drawer-head">
        <h2 className="drawer-title">{memory.title}</h2>
        <p className="drawer-loc">
          <img src={mapPinIcon} alt="" />
          {memory.location}
        </p>
      </div>

      <div className="drawer-photo">
        {photo && <img className="drawer-photo-img" src={photo} alt={memory.title} />}
        {memory.photos.length > 1 && (
          <div className="drawer-dots">
            {memory.photos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                className={index === activePhoto ? 'drawer-dot drawer-dot-on' : 'drawer-dot'}
                onClick={() => onSelectPhoto(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === activePhoto}
              />
            ))}
          </div>
        )}
      </div>

      <div className="drawer-card drawer-card-date">
        <span className="drawer-tile">
          <img src={calendarIcon} alt="" />
        </span>
        <span className="drawer-date-text">
          <span className="eyebrow drawer-date-label">TRIP DATE</span>
          <span className="drawer-date-value">{memory.tripDate}</span>
        </span>
      </div>

      <button type="button" className="drawer-upload" onClick={onUpload}>
        <img src={uploadIcon} alt="" />
        UPLOAD NEW PICTURE
      </button>

      <div className="drawer-card drawer-card-profile">
        <span className="eyebrow">MY PROFILE &amp; STATS</span>
        <div className="drawer-stats-row">
          <span className="drawer-avatar-lg">
            <img src={userIcon} alt="" />
          </span>
          <div className="drawer-stats">
            {stats.map((stat) => (
              <span className="drawer-stat" key={stat.label}>
                <img src={stat.icon} alt="" />
                <span className="drawer-stat-text">
                  <span className="drawer-stat-value">{stat.value}</span>
                  <span className="drawer-stat-label">{stat.label}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="drawer-prefs" onClick={onOpenPreferences}>
          <span className="eyebrow drawer-prefs-label">ACCOUNT PREFERENCES</span>
          <img src={chevronFaintIcon} alt="" />
        </button>
      </div>

      <div className="drawer-shared">
        <span className="eyebrow">SHARED WITH</span>
        <div className="drawer-shared-row">
          {memory.sharedWith.map((person) => (
            <img key={person.name} className="drawer-avatar" src={person.avatar} alt={person.name} />
          ))}
          <button type="button" className="drawer-add" onClick={onAddPerson} aria-label="Share with someone else">
            <img src={plusIcon} alt="" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default DetailDrawer;
