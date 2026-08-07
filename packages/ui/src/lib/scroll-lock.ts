// Native scrolling lives inside ScrollViews an overlay simply covers, so
// there is nothing to lock. The web half is in ./scroll-lock.web.

export function useScrollLock(_locked: boolean): void {}
