const { getContainerTag, getClient } = require("./goal-store");

async function main() {
  const containerTag = getContainerTag();
  const client = getClient();

  const result = await client.documents.list({
    containerTags: [containerTag],
    filters: { AND: [{ key: "type", value: "decision", filterType: "metadata" }] },
    sort: "createdAt",
    order: "desc",
    limit: 10,
    includeContent: true,
  });

  console.log(`Found ${result.memories.length} decision log entries for ${containerTag}:\n`);
  for (const doc of result.memories) {
    console.log(`--- ${doc.createdAt} (status: ${doc.status}) ---`);
    console.log(doc.content);
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
