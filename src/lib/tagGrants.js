// Resolve both current Firestore tag IDs and legacy tag-name references.
const resolveLinkedTagIds = (tag, allTags) => {
  const grants = Array.isArray(tag?.grantsTags) ? tag.grantsTags : [];
  return grants
    .map(grant => {
      const reference = typeof grant === 'string' ? grant : grant?.id || grant?.name;
      return allTags.find(candidate => candidate.id === reference || candidate.name === reference)?.id;
    })
    .filter(Boolean);
};

// Board's access settings correspond to the Admin and Super Admin profile
// tags. Include them as defaults as well, so the profile's visible tags stay
// in sync with the Board configuration.
export const getGrantedTagIds = (tag, allTags) => {
  const granted = resolveLinkedTagIds(tag, allTags);

  if (tag?.name === 'Board') {
    if (tag.grantsAdmin) {
      const adminTag = allTags.find(candidate => candidate.name === 'Admin');
      if (adminTag) granted.push(adminTag.id);
    }
    if (tag.grantsSuperAdmin) {
      const superAdminTag = allTags.find(candidate => candidate.name === 'Super Admin');
      if (superAdminTag) granted.push(superAdminTag.id);
    }
  }

  return [...new Set(granted)];
};

// Build human-readable mirror fields (`tagNames`, `customFieldsReadable`) so the
// raw Firestore user document is legible in the Firebase console. `tags` is
// stored as tag document IDs and `customFields` is keyed by custom-field document
// IDs, both of which look like random strings in the console. These mirrors are
// for readability only — the app always reads the ID-based `tags`/`customFields`
// as the source of truth, so a later rename may leave a mirror briefly stale
// without any functional impact.
export const buildReadableMirrors = (tagIds, allTags, customFieldsMap, allCustomFields) => {
  const tagNames = (tagIds || [])
    .map(id => (allTags || []).find(t => t.id === id)?.name)
    .filter(Boolean);
  const customFieldsReadable = {};
  for (const [fieldId, value] of Object.entries(customFieldsMap || {})) {
    const name = (allCustomFields || []).find(f => f.id === fieldId)?.name || fieldId;
    customFieldsReadable[name] = value;
  }
  return { tagNames, customFieldsReadable };
};

// Tags intentionally grant one level only: selected tags grant their direct
// defaults, but a granted tag does not recursively grant more tags.
export const expandTagIds = (selectedTagIds, allTags) => {
  const expanded = [...new Set(selectedTagIds || [])];
  for (const tagId of selectedTagIds || []) {
    const tag = allTags.find(candidate => candidate.id === tagId);
    for (const grantedTagId of getGrantedTagIds(tag, allTags)) {
      if (!expanded.includes(grantedTagId)) expanded.push(grantedTagId);
    }
  }
  return expanded;
};
