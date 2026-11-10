# Changelog

User-facing changes only, recorded once a feature works end to end.

## Added

- Sign in with Google from a full-screen landing page with an animated title.
- Pick your favorite movie on first sign-in. The title is checked as you type and again on the server.
- A dashboard that shows your name, email and photo (or your initials), your movie, and an AI-generated fact about it printed on a movie ticket.
- Edit your movie in place. The new title shows right away and switches back if the save fails.
- Ask for a new fact once a minute. The button counts down, and the ticket rolls up while the fact prints.
- If the AI service is slow or down, you see your last fact instead of an error. With no earlier fact, you get a clear message and a Try again button.
- Toast notifications for signing in and out, finishing onboarding, fact generation, saves and errors.
- A Docs page, linked from the landing footer, that explains how the app works with diagrams and every design decision.
- A Pandoras Box logo in the browser tab and on the iOS home screen.
- A limit of 20 new facts every 10 minutes per account. Past it you see your last fact for that movie, or a message asking you to try again in a few minutes.
- Works on phones and desktops.
