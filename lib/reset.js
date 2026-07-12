async function listAllDocumentIds(client, containerTag) {
  const ids = [];
  let page = 1;
  while (true) {
    const result = await client.documents.list({ containerTags: [containerTag], page, limit: 100 });
    for (const m of result.memories) ids.push(m.id);
    if (page >= result.pagination.totalPages) break;
    page++;
  }
  return ids;
}

async function clearProjectMemories(client, containerTag) {
  const ids = await listAllDocumentIds(client, containerTag);
  if (ids.length === 0) return { deletedCount: 0 };

  let deletedCount = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const res = await client.documents.deleteBulk({ ids: batch });
    deletedCount += (res && res.deletedCount) || batch.length;
  }
  return { deletedCount };
}

module.exports = { clearProjectMemories };
