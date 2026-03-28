import { createTRPCClient } from "@trpc/client"
import type { AppRouter } from "@shared/trpc-router-type"
import { createPostMessageLink } from "./trpc-link"

export const trpc = createTRPCClient<AppRouter>({
	links: [createPostMessageLink()],
})
