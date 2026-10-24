# Taxonomy v1

| ID | Required evidence | Adjacent choices |
| --- | --- | --- |
| cafe | `amenity=cafe`, excluding exact `bubble_tea` cuisine token | bakery, bubble-tea |
| bakery | `shop=bakery` | cafe |
| bubble-tea | `amenity` cafe/fast_food/restaurant and exact `bubble_tea` cuisine token | cafe |

Cuisine is split on semicolons, trimmed, and compared as whole tokens. Names never establish a qualifier. Café and bubble tea are intentionally disjoint. A feature matching multiple requested categories is assigned to the direct category first, then the sorted adjacent list, and is counted once by source type/ID.

Lifecycle keys for disused, abandoned, demolished, removed, razed, construction, proposed, and was are conservatively excluded when affirmative or descriptive. Closed lifecycle/operational status, closed amenities, and `opening_hours=closed` also exclude records. This is conservative evidence handling; it may exclude ambiguous historical tagging. `no`, `false`, `0`, and empty lifecycle values are not treated as affirmative.

Alias matching normalizes Unicode accents and punctuation, then uses token boundaries. Ambiguity returns all supported matches for confirmation. Unsupported input does not fall back to a guessed category.

Halal food, pharmacy, and supermarket are deferred. In particular, halal food must not be inferred from business names or cuisine geography. Add reviewed explicit qualifier rules, negative cases, and genuine source inspection before expanding the registry; bump the version to invalidate incompatible caches.

Evidence fields contain the exact original matching tag values. Distinct OSM objects are never merged by name. Counts describe mapped features, not unique real-world businesses.
