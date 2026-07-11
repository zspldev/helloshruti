---
name: HelloShruti auth architecture
description: Decision on how login/accounts were layered onto the previously local-only HelloShruti app.
---

Replit-managed Clerk was added for login/signup (email+password + Google). Home route ("/") is a
public landing page; "/dashboard", "/onboarding", "/article/:id", "/history" are gated behind
Clerk sign-in and redirect signed-out users to "/".

**Why:** the app previously stored the user profile (name, interests, reading prefs) and reading
history/notes entirely in browser localStorage with no accounts. Adding real accounts didn't yet
justify introducing a database — no other part of the app needs server-side persistence.

**How to apply:** profile/history data is still localStorage-only, but now keyed per Clerk user id
(`helloshruti_profile_<userId>`) so multiple accounts on the same device/browser don't collide or
leak each other's data. If cross-device sync of profile/history is ever requested, that's the
trigger to introduce a real database keyed by Clerk userId instead of localStorage.
