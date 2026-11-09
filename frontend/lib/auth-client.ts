"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { httpBase } from "./config";

export const authClient = createAuthClient({
  baseURL: httpBase(),
  fetchOptions: { credentials: "include" },
  plugins: [organizationClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
