export type FileCategory = "all" | "image" | "document" | "video" | "audio" | "archive" | "other";
export type SortField = "name" | "size" | "date";
export type SortOrder = "asc" | "desc";

export type CloudFile = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  extension: string;
  category: Exclude<FileCategory, "all">;
};

export type CloudFileVersion = {
  key: string;
  name: string;
  fileName?: string;
  versionId: string;
  lastModified: string | null;
  size: number;
  isCurrentVersion: boolean;
};
