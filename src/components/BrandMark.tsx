import mark from '../assets/brand/mapmory-mark.jpg'
import './BrandMark.css'

/** The MapMory app icon beside the wordmark; decorative, since the name is always written next to it. */
export default function BrandMark() {
  return <img className="brand-mark" src={mark} alt="" width={36} height={36} />
}
