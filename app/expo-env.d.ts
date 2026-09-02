/// <reference types="expo/types" />

// Committed deliberately, against Expo's own scaffold-default advice to
// gitignore this file: this project's CI runs `tsc --noEmit` directly
// (never `expo start`/`expo prebuild`, which is what normally regenerates
// this on demand), so a fresh checkout with no local Expo run has nothing
// to provide it -- and without it, `process.env.EXPO_PUBLIC_*` reads
// throughout services/api.ts fail to typecheck with "Cannot find name
// 'process'". Safe to commit: no secrets, just a type reference, and its
// contents are deterministic (Expo regenerates the exact same file).
