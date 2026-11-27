const { publicUrl } = require('../providers/storage');

// The logged-in user's own view (includes their own mobile).
function selfUser(u, profile = {}) {
  return {
    publicId: u.public_id,
    name: u.name,
    mobile: u.mobile,
    email: u.email || null,
    city: u.city || null,
    photoUrl: publicUrl(u.photo_key),
    role: u.role,
    status: u.status,
    preferredLang: u.preferred_lang,
    whatsappOptIn: !!u.whatsapp_opt_in,
    ...profile,
  };
}

module.exports = { selfUser };
