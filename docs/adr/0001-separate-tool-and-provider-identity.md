# Separate Tool and Subscription Provider identity

SubLens keeps Tool IDs and Subscription Provider IDs independent, and stores a nullable Tool link on
each Subscription Snapshot. A Provider can observe an account that does not represent a catalog Tool
(for example, a storage-only Google One plan), so a static one-to-one Provider-to-Tool mapping would
mislabel subscriptions and make future shared Providers difficult to represent.
