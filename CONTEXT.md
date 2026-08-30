# SubLens

SubLens is a local-first launcher for opening AI tools and observing subscriptions that the user
chooses to connect.

## Language

**Tool**:
An AI product with a stable identity and a web destination that can be opened from the launcher.
_Avoid_: Provider, service

**Built-in Tool**:
A Tool curated and shipped in the SubLens catalog.
_Avoid_: Default provider

**Custom Tool**:
A Tool created locally by the user and not included in the built-in catalog.
_Avoid_: Custom provider

**Subscription Provider**:
An adapter that observes subscription information from one external product account after the user
grants access.
_Avoid_: Tool, integration

**Subscription Snapshot**:
The latest locally stored observation returned by a Subscription Provider. A snapshot may be linked
to a Tool, but the Provider and Tool retain separate identities.
_Avoid_: Subscription cache, provider data

**Connection**:
The user's current permission grant that allows a Subscription Provider to observe an account.
_Avoid_: Login, authorization token

**Launch**:
A user action that opens a Tool destination and updates its local recency and usage history.
_Avoid_: Visit, click
