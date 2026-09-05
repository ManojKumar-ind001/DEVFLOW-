declare module "unzipper" {
  interface ZipEntry {
    path: string;
    type: "File" | "Directory";
    vars: {
      compressedSize: number;
      uncompressedSize: number;
    };
  }

  interface ZipDirectory {
    files: ZipEntry[];
  }

  export const Open: {
    buffer(input: Buffer): Promise<ZipDirectory>;
  };
}
