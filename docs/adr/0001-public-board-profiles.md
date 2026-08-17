# Public Board Profiles preserve private User records

The Board page reads Public Board Profiles rather than User records because the page is public while User records can contain registration and permission data. Administrators maintain the public projection when they add or update a Board member, and public Firestore reads are restricted to that projection.
