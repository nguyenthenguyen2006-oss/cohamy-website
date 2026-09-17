import type { Metadata } from "next";

export const ADMIN_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
};

export const ADMIN_X_ROBOTS_TAG = "noindex, nofollow, noarchive";
