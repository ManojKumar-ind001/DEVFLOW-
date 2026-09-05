#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { DevFlowClient } from "@devflow/api-client";

function usage(): never {
  console.error("Usage: devflow <health|inspect|file> [arguments]");
  process.exit(1);
}

const [, , command, first, second] = process.argv;
const client = process.env.DEVFLOW_API_URL
  ? new DevFlowClient({ baseUrl: process.env.DEVFLOW_API_URL })
  : new DevFlowClient();

try {
  if (command === "health") {
    console.log(JSON.stringify(await client.health(), null, 2));
  } else if (command === "inspect" && first) {
    const bytes = await readFile(first);
    const upload = await client.uploadArchive(bytes, basename(first));
    const result = await client.waitForJob(upload.job.id);
    if (result.job.state === "failed") {
      console.error(`Inspection failed: ${result.job.error ?? "unknown error"}`);
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ artifact: upload.artifact, inspection: result.result }, null, 2));
    }
  } else if (command === "file" && first && second) {
    const preview = await client.getFilePreview(first, second);
    process.stdout.write(preview.content);
    if (preview.truncated) process.stderr.write("\n[preview truncated at 256 KB]\n");
  } else {
    usage();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
