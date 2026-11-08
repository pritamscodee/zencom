"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { API_URL } from "./config";

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
  plugins: [organizationClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
