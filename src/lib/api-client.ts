import type { CloudFile, CloudFileVersion, FileCategory, SortField, SortOrder } from "@/types/cloud-file";

export type FilesResponse = {
  ok: boolean;
  success?: boolean;
  configured?: boolean;
  files?: CloudFile[];
  message?: string;
  error?: string | boolean;
};

function encodeS3Key(key: string) {
  return encodeURIComponent(key);
}

async function readJson<T>(
  response: Response
): Promise<T & { message?: string; error?: string | boolean }> {
  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `API returned invalid response (${response.status}): ${text.slice(0, 200)}`
    );
  }

  if (!response.ok) {
    const message =
      data.message ??
      (typeof data.error === "string" ? data.error : undefined) ??
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

export async function fetchFiles(params: { search?: string; filter?: FileCategory; sort?: SortField; order?: SortOrder }) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.filter) query.set("filter", params.filter);
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);

  const response = await fetch(`/api/files?${query.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  return readJson<FilesResponse>(response);
}

export async function deleteFile(key: string) {
  const response = await fetch(
    `/api/files?key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  return readJson<{
    ok?: boolean;
    success?: boolean;
    message?: string;
    error?: string | boolean;
  }>(response);
}

 export async function getDownloadUrl(key: string) {
  const response = await fetch(`/api/files/download?key=${encodeURIComponent(key)}`, {
    credentials: "include",
  });
  const data = await readJson<{ ok?: boolean; success?: boolean; download?: { url: string }; message?: string; error?: string | boolean }>(response);
  if (!data.download) throw new Error(data.message ?? "Unable to create download URL");
  return data.download.url;
}

export async function fetchFileVersions(key: string) {
  const response = await fetch(`/api/files/${encodeS3Key(key)}/versions`, {
    cache: "no-store",
    credentials: "include",
  });
  const data = await readJson<{ ok?: boolean; success?: boolean; versions?: CloudFileVersion[]; message?: string; error?: string | boolean }>(response);
  return data.versions ?? [];
}
