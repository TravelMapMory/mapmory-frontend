import './PrivacyScreen.css'

const ISSUES_URL = 'https://github.com/TravelMapMory/mapmory-frontend/issues'

/**
 * The public privacy policy. The text states only what the code does today:
 * when a feature, provider or storage key changes, change this page with it.
 * The caller supplies the header and the <main> landmark.
 */
export default function PrivacyScreen() {
  return (
    <article className="pp" aria-labelledby="pp-title">
      <h1 id="pp-title">Privacy policy</h1>
      <p className="pp-date">Effective 27 November 2026</p>

      <section className="pp-short" aria-labelledby="pp-short">
        <h2 id="pp-short">In short</h2>
        <ul>
          <li>MapMory is a student project. Your photos and trips are private until you share them.</li>
          <li>We keep your original photos, the place and time stored in them, and the trip text you type.</li>
          <li>Google&rsquo;s sign-in service (Firebase) handles your email address and password. Our database does not store them.</li>
          <li>The exact position of a photo is sent to Geoapify to find the city name. Shares show only approximate positions.</li>
          <li>The map in your browser loads from outside services. They can see your IP address.</li>
          <li>You can delete a trip, or your whole account, in the app.</li>
        </ul>
      </section>

      <section aria-labelledby="pp-who">
        <h2 id="pp-who">Who runs MapMory and how to reach us</h2>
        <p>
          MapMory is run by the MapMory student team as a project in the Design of Web Services course at Aalto University, 2026.
          It is not a company.
        </p>
        <p>
          To ask a question about privacy, open an issue on our <a href={ISSUES_URL}>GitHub issue tracker</a>.
        </p>
        <p className="pp-warn">
          <strong>Issues are public.</strong> Do not post personal data, photos, locations or share links in an issue. If you want
          your data removed, you can do it yourself in the app (see &ldquo;Deleting your data&rdquo;).
        </p>
        <p>If someone else&rsquo;s public share shows you, use Report on that share page.</p>
      </section>

      <section aria-labelledby="pp-data">
        <h2 id="pp-data">What we process, and why</h2>
        <p>We process this data only to run the app: to sign you in, to place your photos on a map and to share them when you choose.</p>

        <h3>Your account</h3>
        <ul>
          <li>
            When you sign up, your email address, password and optional name go to Firebase Authentication, a Google service.
            Firebase sends you the email to confirm your address.
          </li>
          <li>
            With each request our server receives a sign-in token from Firebase. The token includes your email address, but the server
            uses only your account ID from it. It stores that ID to tie your data to your Firebase account. It does not store your email address or name.
          </li>
        </ul>

        <h3>Your photos</h3>
        <ul>
          <li>You upload JPEG or PNG files up to 25 MB. They go from your browser straight to Google Cloud Storage.</li>
          <li>
            The original file is kept exactly as you uploaded it, including any location, time and camera details inside it.
            We never show or share the original. Unless you share them, only you can see your photos in the app.
          </li>
          <li>
            Our server reads the GPS position, the capture time and the orientation from the original. It saves the position and
            time in the database. Other details, such as the camera model, are not read or saved in the database.
          </li>
          <li>
            Our server also makes one display copy, at most 2048 pixels on its longest side, with no location or camera details inside it.
            This copy is what you and the people you share with see.
          </li>
          <li>The file name never reaches our server. Your browser keeps it (see &ldquo;Browser storage&rdquo;).</li>
        </ul>

        <h3>Your trips and places</h3>
        <ul>
          <li>We store the trip titles and notes you type.</li>
          <li>
            For each photo with a position, we store that position, the country, city and place name, and the place&rsquo;s source and credit.
            You can correct a photo&rsquo;s position. The original position from the photo stays stored next to the corrected one.
          </li>
          <li>
            When you search for a place, our server sends the text you type to Geoapify. The place search can be used without signing in.
          </li>
        </ul>

        <h3>Sharing and reports</h3>
        <ul>
          <li>
            A share stores the photos you picked (up to 500 from one trip), its title and description, its type (link or public),
            a secret token for the link and the dates it was created and revoked.
          </li>
          <li>
            When you create a share, our server sends the city and country text of the photos to Geoapify to find the city centre.
          </li>
          <li>
            Anyone can report a public share without signing in. We store the share, the reason they wrote (up to 500 characters)
            and the date. We do not store who reported it, and the database does not store their IP address.
          </li>
        </ul>
      </section>

      <section aria-labelledby="pp-processors">
        <h2 id="pp-processors">Who processes data for us</h2>
        <ul>
          <li>
            <strong>Google Firebase Authentication</strong> handles sign-in: your email address, password, name and sign-in tokens.
          </li>
          <li>
            <strong>Google Cloud</strong> runs our website and API on a virtual machine in Finland (europe-north1) and stores your
            photo files in a Cloud Storage bucket in the same region. The server may keep logs with IP addresses and the addresses of
            pages requested. Our log storage uses Google Cloud&rsquo;s default setting, which keeps entries for 30 days.
          </li>
          <li>
            <strong>Supabase</strong> hosts our PostgreSQL database in Ireland (eu-west-1). It holds your trips, photo details,
            places, shares and reports.
          </li>
          <li>
            <strong>Geoapify</strong> finds place names. Our server sends it a photo&rsquo;s exact latitude and longitude after an
            upload, and again when you move a photo by hand on the map (not when you pick a place from the search list). If the lookup
            fails, we retry up to three more times when you open the trip.
            It also receives the text of place searches and the city and country text used when you create a share. Geoapify sees
            our server&rsquo;s IP address, not yours.
          </li>
        </ul>
        <p>
          People on the student team who have access to these services can technically read the stored data. We do not sell data
          and we have no analytics or advertising.
        </p>
      </section>

      <section aria-labelledby="pp-browser">
        <h2 id="pp-browser">Other services your browser contacts</h2>
        <p>Your browser talks to these directly. Each one can see your IP address and that the request came from mapmory.app.</p>
        <ul>
          <li>
            <strong>Map tiles.</strong> The &ldquo;Map&rdquo; and &ldquo;Minimal&rdquo; styles load from OpenStreetMap (tile.openstreetmap.org),
            &ldquo;Terrain&rdquo; from OpenTopoMap (opentopomap.org) and &ldquo;Satellite&rdquo; from Esri (server.arcgisonline.com).
            A tile request reveals the map area and zoom level you are looking at. The layers menu also loads one small preview tile
            from each of these services.
          </li>
          <li>
            <strong>Google Cloud Storage</strong> sends you display images and receives your uploads, through short-lived signed links.
          </li>
          <li>
            <strong>Google sign-in servers</strong> (googleapis.com) are contacted when you sign up, log in, stay signed in or delete your account.
          </li>
        </ul>
        <p>Fonts, scripts and the app&rsquo;s own pictures are served from mapmory.app itself. Your browser does not contact Geoapify.</p>
      </section>

      <section aria-labelledby="pp-sharing">
        <h2 id="pp-sharing">Sharing and its limits</h2>
        <ul>
          <li>Everything is private until you share it.</li>
          <li>
            <strong>Link share:</strong> anyone who has the link can open it. Treat the link like a key.
          </li>
          <li>
            <strong>Public share:</strong> it also appears on the public map and has a public page, for anyone, without signing in.
            Nobody reviews a public share before it goes live.
          </li>
          <li>
            People who open a share see its title, description and date, and for each photo the display image, capture time, city,
            country and an approximate position. The share title starts as your trip title, and you can change it before you share.
            People who open a share do not see your name, email address or trip notes.
          </li>
          <li>
            The approximate position is the centre of the city when known. Otherwise it is the exact position rounded to about 1 km.
            Exact coordinates are not sent in a share.
          </li>
          <li>
            Anyone can report a public share. A reported public share is hidden from the public map and its public page until a team member reviews the report by hand.
            Nobody is notified automatically, so this can take a while. Its link version keeps working.
          </li>
          <li>
            <strong>Revoking</strong> a share stops it at once. Image links already issued can keep working for up to 1 hour. Anyone who
            already saved or copied an image keeps it, and we cannot take it back.
          </li>
        </ul>
      </section>

      <section aria-labelledby="pp-delete">
        <h2 id="pp-delete">Deleting your data</h2>
        <h3>Delete a trip</h3>
        <p>
          On the trip page, choose &ldquo;Delete trip&rdquo;. We remove the trip, its photos, its shares and the reports about them from
          the database, and its share links stop working. Then we delete the photo files from Cloud Storage. If that last step fails, we only
          log it and do not retry, so files can stay behind.
        </p>
        <h3>Delete your account</h3>
        <p>
          In the account menu, choose &ldquo;Delete account&hellip;&rdquo; and enter your password. We remove all your trips and photos and your
          record in our database, then the photo files in Cloud Storage, then your sign-in account at Firebase. As with trips, photo files that
          fail to delete can stay behind. If deleting the sign-in account fails, you are signed out and your MapMory data is already gone,
          but your sign-in account remains. The app tells you if this happens. You can then sign in again and choose &ldquo;Delete account&hellip;&rdquo;
          once more to remove it.
        </p>
        <h3>What can remain</h3>
        <ul>
          <li>Cloud Storage keeps deleted files recoverable for 7 days (its soft-delete setting) before it deletes them.</li>
          <li>
            Logs, and backups kept by Google Cloud, Supabase or Firebase, can hold data for a while. We have not set our own retention
            period for them and make no promise about them.
          </li>
          <li>Copies that other people saved from a share are outside our control.</li>
        </ul>
      </section>

      <section aria-labelledby="pp-storage">
        <h2 id="pp-storage">Browser storage</h2>
        <p>
          MapMory sets no cookies and uses no analytics or advertising tools. It keeps the following in your browser. You can clear it
          in your browser&rsquo;s site settings.
        </p>
        <ul>
          <li>
            <strong>Sign-in session</strong> (IndexedDB, set by Firebase): <code>firebaseLocalStorageDb</code> holds who you are signed in as and your sign-in tokens, and{' '}
            <code>firebase-heartbeat-database</code> holds the Firebase SDK version and date.
          </li>
          <li>
            <code>mapmory.basemap</code> (local storage): the map style you chose.
          </li>
          <li>
            <code>mapmory.uploads.&#123;trip id&#125;</code> (local storage): the files you are uploading to a trip, with their original
            file names and the temporary upload address, so an interrupted upload can be resumed. The app stops using an unfinished entry after 7 days and a finished
            one after 1 day, and removes old entries the next time you upload to that trip. Signing out or deleting your account does not clear
            these entries. You can clear them in your browser&rsquo;s site settings.
          </li>
          <li>
            <code>mapmory.guide.places-reviewed.&#123;account id&#125;</code> and <code>mapmory.guide.hidden.&#123;account id&#125;</code> (local storage):
            whether you have reviewed a place and whether you hid the getting-started guide.
          </li>
          <li>
            <code>mapmory.publicMapView</code> (session storage): where you last looked on the public map, until you close the tab.
          </li>
        </ul>
      </section>

      <section aria-labelledby="pp-changes">
        <h2 id="pp-changes">Changes to this policy</h2>
        <p>
          We update this page when the app changes how it handles your data; the date above shows the current version.
        </p>
      </section>
    </article>
  )
}
