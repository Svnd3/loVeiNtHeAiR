// Fires off a plain Image() download for each URL the instant it's called so
// the browser starts fetching/caching it right away -- by the time the user
// actually scrolls to whatever renders it (CurveGallery, MemoryCard,
// ScratchReveal, ...) it's already sitting in the browser's cache instead of
// loading from scratch. Safe to call with duplicates/empties -- the browser
// dedupes identical URLs on its own, and falsy entries are just skipped.
export function preloadImages(urls: (string | null | undefined)[]) {
  for (const url of urls) {
    if (!url) continue
    const img = new Image()
    img.src = url
  }
}
