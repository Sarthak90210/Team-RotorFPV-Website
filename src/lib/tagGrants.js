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
