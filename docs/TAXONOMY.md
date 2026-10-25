# Business types and evidence (registry v2)

The source of truth is [`src/lib/categories.ts`](../src/lib/categories.ts). There are 30 supported mapped types. The original five predicates remain unchanged for bundled snapshot compatibility; the additional types require live retrieval unless an exact compatible capture exists.

| ID | Required evidence | Adjacent choices |
| --- | --- | --- |
| cafe | `amenity=cafe`, excluding exact `bubble_tea` cuisine token | bakery, bubble-tea |
| bakery | `shop=bakery` | cafe |
| bubble-tea | `amenity` cafe/fast_food/restaurant and exact `bubble_tea` cuisine token | cafe |
| pharmacy | `amenity=pharmacy` or `healthcare=pharmacy` | none |
| supermarket | `shop=supermarket` | none |

Cuisine is split on semicolons, trimmed, and compared as whole tokens. Names never establish a qualifier. Café and bubble tea are intentionally disjoint. A feature matching multiple requested categories is assigned to the direct category first, then the sorted adjacent list, and is counted once by source type/ID.

Lifecycle keys for disused, abandoned, demolished, removed, razed, construction, proposed, and was are conservatively excluded when affirmative or descriptive. Closed lifecycle/operational status, closed amenities, and `opening_hours=closed` also exclude records. This is conservative evidence handling; it may exclude ambiguous historical tagging. `no`, `false`, `0`, and empty lifecycle values are not treated as affirmative.

Alias matching normalizes Unicode accents and punctuation, then uses token boundaries. The local classifier exposes ambiguous matches; automatic NVIDIA interpretation can select a supported type or return null. Unsupported input does not fall back to a guessed category.

Pharmacy follows the approved `amenity=pharmacy` tag, with `healthcare=pharmacy` accepted as an exact additional tag. The deprecated `shop=pharmacy` tag and `shop=chemist` are excluded because they do not reliably identify a pharmacist-led medicine seller. [OSM pharmacy tagging](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dpharmacy), [deprecated shop=pharmacy tag](https://wiki.openstreetmap.org/wiki/Tag:shop%3Dpharmacy), and [healthcare=pharmacy](https://wiki.openstreetmap.org/wiki/Tag:healthcare%3Dpharmacy).

Supermarket requires `shop=supermarket`. `shop=convenience` and `shop=grocery` are separate smaller store types and are not silently folded into supermarket counts. [OSM supermarket tagging](https://wiki.openstreetmap.org/wiki/Supermarket) and [convenience store distinction](https://wiki.openstreetmap.org/wiki/Tag:shop%3Dconvenience).

Halal food remains deferred. In particular, halal food must not be inferred from business names or cuisine geography. Add reviewed explicit qualifier rules, negative cases, and genuine source inspection before expanding the registry; bump the version to invalidate incompatible caches.

Evidence fields contain the exact original matching tag values. Distinct OSM objects are never merged by name. Counts describe mapped features, not unique real-world businesses.

## Additional mapped types

| ID | Label | Exact evidence |
| --- | --- | --- |
| restaurant | Restaurant | `amenity=restaurant` |
| fast-food | Fast food / takeaway | `amenity=fast_food` |
| bar | Bar / pub | `amenity=bar` or `amenity=pub` |
| ice-cream | Ice cream | `amenity=ice_cream` |
| convenience | Convenience store | `shop=convenience` |
| clothing | Clothing shop | `shop=clothes` |
| shoes | Shoe shop | `shop=shoes` |
| electronics | Electronics shop | `shop=electronics` or `shop=computer` |
| books | Bookshop | `shop=books` |
| florist | Florist | `shop=florist` |
| pet-shop | Pet shop | `shop=pet` |
| hairdresser | Hairdresser / barber | `shop=hairdresser` |
| beauty | Beauty / nail salon | `shop=beauty` |
| laundry | Laundry / dry cleaner | `shop=laundry` or `shop=dry_cleaning` |
| gym | Gym / fitness centre | `leisure=fitness_centre` |
| dentist | Dentist | `amenity=dentist` |
| clinic | Medical clinic | `amenity=clinic` or `amenity=doctors` |
| veterinary | Veterinarian | `amenity=veterinary` |
| car-repair | Car repair | `shop=car_repair` |
| hotel | Hotel / guest house | `tourism=hotel` or `tourism=guest_house` |
| software | Software / IT office | `office=it` |
| coworking | Coworking space | `office=coworking` |
| estate-agent | Estate agent | `office=estate_agent` |
| accountant | Accountant | `office=accountant` |
| lawyer | Law office | `office=lawyer` |
