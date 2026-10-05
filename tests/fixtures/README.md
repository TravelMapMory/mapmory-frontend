These tiny images were generated for the tests; they are not user photographs.

- `no-metadata.png`: valid PNG with no EXIF.
- `with-gps.jpg`: valid JPEG with Paris GPS and local capture time 2026-06-01 09:12:00, no UTC offset.
- `invalid-date.jpg`: the same GPS but an impossible capture timestamp.

Size-boundary tests append padding to the valid PNG. They exercise the byte
limit without requiring a large image or committing a 25 MB fixture.
