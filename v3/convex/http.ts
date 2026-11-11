import { httpRouter } from "convex/server";
import {
  deleteMediaHttp,
  issueUploadUrlHttp,
  resolveFileUrlHttp,
} from "./studioMedia";

const http = httpRouter();

http.route({
  path: "/studio/upload-url",
  method: "POST",
  handler: issueUploadUrlHttp,
});

http.route({
  path: "/studio/file-url",
  method: "POST",
  handler: resolveFileUrlHttp,
});

http.route({
  path: "/studio/delete",
  method: "POST",
  handler: deleteMediaHttp,
});

export default http;
