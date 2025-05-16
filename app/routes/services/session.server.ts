import { createCookieSessionStorage } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [process.env.SESSION_STORAGE_SECRET || "_s3cr3tz_"],
    secure: process.env.NODE_ENV === "production",
  },
});
