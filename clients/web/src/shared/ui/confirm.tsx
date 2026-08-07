// Shim: the confirm dialog is the design system's (`confirm()` +
// `<ConfirmHost/>` from @kroma/ui/kit), shared with module pages. Re-exported
// so call sites keep importing from `#web/shared/ui`; the single
// `<ConfirmHost />` root in `routes/__root.tsx` serves both.

export { ConfirmHost, type ConfirmOptions, confirm as confirmDialog } from '@kroma/ui/kit';
