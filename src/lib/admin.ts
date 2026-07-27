// The one account that can browse every surprise anyone's made (Admin.tsx)
// and pick one as the public /surprise preview's live content
// (set_preview_template in schema.sql). Deliberately its own constant, not
// folded into FREE_ACCESS_EMAILS in payments.ts -- that list also includes
// clivemuturi@gmail.com, who gets free surprises but not this.
//
// This only gates the UI (hiding the link, redirecting away from /admin).
// The actual boundary is server-side: admin_list_surprises() and
// set_preview_template() in schema.sql hardcode this same address in their
// own WHERE clause via auth.email(), so they return nothing / do nothing
// for anyone else regardless of what the client sends.
export const SUPER_ADMIN_EMAIL = 'hezronsande2@gmail.com'
