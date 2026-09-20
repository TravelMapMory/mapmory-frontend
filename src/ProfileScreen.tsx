/**
 * Fabricated profile figures standing in for the mock-up's identity block.
 * Replaced once the backend exposes a real profile.
 */
const PLACEHOLDER_COUNTS = [
  { label: 'Memories', value: '73' },
  { label: 'Cities', value: '12' },
  { label: 'Following', value: '18' },
]

/**
 * The profile screen, mirroring the `unimap-profile-info` frame: an identity
 * card beside a featured memory, with a gallery of that trip's photos below.
 *
 * Photos render as labelled placeholder blocks — the design uses real travel
 * images, and neither committing stand-in image files nor hotlinking someone
 * else's photos belongs in a skeleton.
 */
export default function ProfileScreen() {
  return (
    <>
      <div className="profile-row">
        <section className="card identity">
          <div className="avatar" />
          <h2>Traveller name</h2>
          <p className="eyebrow">Helsinki, Finland</p>
          <div className="meta">
            {PLACEHOLDER_COUNTS.map((count) => (
              <div key={count.label}>
                <b>{count.value}</b>
                <span className="eyebrow">{count.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card hero">
          <div className="photo" data-tall="true">
            featured photo
          </div>
          <div className="hero-body">
            <h2>Paris, France</h2>
            <p>Sep 2026 · 18 photos · grouped by city</p>
          </div>
        </section>
      </div>

      <div className="gallery">
        {['1', '2', '3'].map((slot) => (
          <div className="card" key={slot}>
            <div className="photo">photo {slot}</div>
          </div>
        ))}
      </div>
    </>
  )
}
