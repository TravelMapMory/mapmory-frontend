import {
  Calendar,
  ChevronRight,
  Globe,
  Heart,
  ImageIcon,
  MapPin,
  Plus,
  Share2,
  SlidersVertical,
  Upload,
  User,
  Video,
} from 'lucide-react';
import carouselPhoto from '../assets/photos/memory-carousel.jpg';
import sharedAvatar1 from '../assets/photos/shared-avatar-1.jpg';
import sharedAvatar2 from '../assets/photos/shared-avatar-2.jpg';
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
 * The content the Figma node ships, exported so screens and stories can render
 * the drawer exactly as designed.
 *
 * All four carousel slides point at the same photograph: the design shows four
 * indicator dots but Figma exports only the slide that is visible, so there is
 * one image and four slots. A host app passes its own URLs instead.
 */
export const featuredMemory: DrawerMemory = {
  badge: '✦ FEATURED MEMORY',
  title: 'My Memory Stream: Latest Vantaa snapshot',
  location: 'Paris, France',
  photos: [carouselPhoto, carouselPhoto, carouselPhoto, carouselPhoto],
  tripDate: '12 Feb 2024',
  countries: 20,
  pictures: 1500,
  accounts: 0,
  sharedWith: [
    { name: 'Shared with person 1', avatar: sharedAvatar1 },
    { name: 'Shared with person 2', avatar: sharedAvatar2 },
  ],
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
 * place, photo carousel, the gallery call to action, trip date, the upload
 * call to action, the profile stats card and the people the memory is shared
 * with.
 *
 * Icons come from `lucide-react`, which is the design's own icon set: each
 * Figma-exported glyph is its Lucide counterpart scaled from Lucide's 24
 * viewBox. The design strokes every icon at 2px as rendered, so `strokeWidth`
 * is 48 / size, and colour is left to CSS through `currentColor`.
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
    { icon: <Globe size={18} strokeWidth={2.6667} aria-hidden />, value: memory.countries, label: 'Countries' },
    { icon: <ImageIcon size={18} strokeWidth={2.6667} aria-hidden />, value: memory.pictures, label: 'Pictures' },
    { icon: <SlidersVertical size={18} strokeWidth={2.6667} aria-hidden />, value: memory.accounts, label: 'Accounts' },
  ];

  return (
    <aside className="drawer">
      <div className="drawer-hdr">
        <span className="drawer-badge eyebrow">
          {memory.badge}
        </span>
        <div className="drawer-hdr-actions">
          <button type="button" className="drawer-icon-btn" onClick={onFavorite} aria-label="Favorite this memory">
            <Heart className="drawer-heart" size={16} strokeWidth={3} aria-hidden />
          </button>
          <button type="button" className="drawer-icon-btn" onClick={onShare} aria-label="Share this memory">
            <Share2 size={16} strokeWidth={3} aria-hidden />
          </button>
          <button type="button" className="drawer-icon-btn" onClick={onExpand} aria-label="Open this memory">
            <ChevronRight size={16} strokeWidth={3} aria-hidden />
          </button>
        </div>
      </div>

      <div className="drawer-head">
        <h2 className="drawer-title">{memory.title}</h2>
        <p className="drawer-loc">
          <MapPin size={14} strokeWidth={3.4286} aria-hidden />
          {memory.location}
        </p>
      </div>

      <div className="drawer-photo">
        {photo && <img className="drawer-photo-img" src={photo} alt={memory.title} />}
        {memory.photos.length > 1 && (
          <div className="drawer-dots">
            {memory.photos.map((_slide, index) => (
              <button
                key={index}
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

      <button type="button" className="drawer-gallery">
        <Video size={18} strokeWidth={2.6667} aria-hidden />
        Relive this Trip (Gallery)
      </button>

      <div className="drawer-card drawer-card-date">
        <span className="drawer-tile">
          <Calendar size={18} strokeWidth={2.6667} aria-hidden />
        </span>
        <span className="drawer-date-text">
          <span className="eyebrow drawer-date-label">TRIP DATE</span>
          <span className="drawer-date-value">{memory.tripDate}</span>
        </span>
      </div>

      <button type="button" className="drawer-upload" onClick={onUpload}>
        <Upload size={16} strokeWidth={3} aria-hidden />
        UPLOAD NEW PICTURE
      </button>

      <div className="drawer-card drawer-card-profile">
        <span className="eyebrow">MY PROFILE &amp; STATS</span>
        <div className="drawer-stats-row">
          <span className="drawer-avatar-lg">
            <User size={24} strokeWidth={2} aria-hidden />
          </span>
          <div className="drawer-stats">
            {stats.map((stat) => (
              <span className="drawer-stat" key={stat.label}>
                {stat.icon}
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
          <ChevronRight size={14} strokeWidth={3.4286} aria-hidden />
        </button>
      </div>

      <div className="drawer-shared">
        <span className="eyebrow">SHARED WITH</span>
        <div className="drawer-shared-row">
          {memory.sharedWith.map((person) => (
            <img key={person.name} className="drawer-avatar" src={person.avatar} alt={person.name} />
          ))}
          <button type="button" className="drawer-add" onClick={onAddPerson} aria-label="Share with someone else">
            <Plus size={14} strokeWidth={3.4286} aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default DetailDrawer;
